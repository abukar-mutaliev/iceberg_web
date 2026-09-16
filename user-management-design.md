# Технический дизайн: управление пользователями в веб-панели

Версия: 1.0
Связанный документ: `web/user-management-requirements.md`
Стек: React 18 + TypeScript + Vite + Ant Design + TanStack Query + React Hook Form + Zod (FSD)
Бэкенд: без изменений в MVP (существующие `/api/admin/*`, `/api/users/:id`, `/api/employee/*`, `/api/drivers/*`)

---

## 0. Зафиксированные решения (из §16 спецификации)

Пока заказчик не переопределил — реализация идёт по этим значениям. Смена решения меняет только указанный слой.

| № | Вопрос | Решение |
|---|---|---|
| 1 | Обычный админ и клиенты | **Нет.** Полный реестр и вкладка CLIENT — только суперадмин. Обычный админ видит `GET /api/admin/staff` (EMPLOYEE / SUPPLIER / DRIVER) и может **создать** CLIENT, но не листает всех клиентов. |
| 2 | Смена роли | **Модалка на карточке** (`width ≥ 720`), не отдельный роут. Контекст пользователя не теряется. |
| 3 | Создание суперадмина | **Два шага:** `POST /api/admin/admins` → на карточке «Назначить суперадмином» (`PATCH change-role` с `newRole: 'ADMIN', isSuperAdmin: true`). Чекбокса при создании нет. |
| 4 | Approve поставщика | **Как есть на сервере.** Модалка без ИНН/компании; в тексте предупреждение, что название компании возьмётся из имени клиента. Поля + патч контроллера — v2. |
| 5 | Пароль при создании | **Показать один раз + «Скопировать».** Генератор на клиенте, удовлетворяющий правилам сервера. На email не отправляем. |
| 6 | Создание CLIENT обычным админом | **Да.** В селекте роли на `/users/new` есть CLIENT. |
| 7 | Источник списка | Суперадмин → `GET /api/admin/users`. Обычный админ → `GET /api/admin/staff`. `GET /api/users` не используем. |
| 8 | Бэкенд в этом релизе | **Не трогаем**, кроме случая блокера. Адаптеры на клиенте сглаживают разные формы ответов. Желательные правки сервера — §11, отдельным коммитом. |

Следствия:

- В UI два режима одной страницы `/users`, а не два разных продукта.
- Номер входа чужого пользователя **не редактируется**. На карточке два поля только для чтения: «Номер входа» (`User.phone` из `GET /api/users/:id`) и «Контакт» (`profile.phone`).
- `ProtectedRoute` не расширяем. Доступ к модулю — `RoleGate`.

---

## 1. Архитектура

Панель остаётся тонким клиентом. Новая логика живёт в FSD-слайсах, существующие продукты/склады/профиль не переписываются.

```
Браузер (web/)
  RoleGate (ADMIN / isSuperAdmin)
        │
        ├─ pages/users            композиция
        ├─ pages/staff-applications
        │
        ▼
  features/user-management
    api/     вызовы + нормализация ответов
    model/   Zod, query-keys, display-name, constants
    ui/      формы, модалки, RoleGate, теги
        │
        ▼
  entities/user | district | warehouse
        │
        ▼
  shared/api/client.ts     Bearer + refresh (уже есть)
        │
        ▼
  Express
    /api/admin/users|staff|admins|change-role|staff-applications
    /api/users/:id
    /api/employee/:id/districts|warehouse|details
    /api/admin/employees/:id/processing-role
    /api/drivers/districts|warehouse
    /api/admin/warehouses/selection
    /api/admin/districts/selection
```

Правила:

- Страницы не ходят в axios напрямую — только через `features/user-management/api` и уже существующие `entities/*`.
- Слайсы `features/staff-application` (подача заявки клиентом) и `features/user-management` (разбор админом) не смешивать. Общие типы заявки — в `entities/staff-application`.
- Импорты только вниз: `pages` → `features`/`widgets`/`entities`/`shared`.

### 1.1 Дерево файлов

```
web/src/
  entities/user/model/types.ts              ← расширить
  entities/user/model/display-name.ts       ← НОВОЕ
  entities/user/model/constants.ts          ← НОВОЕ (подписи ролей, processingRole)
  entities/staff-application/               ← НОВОЕ (типы; api подачи остаётся в features/staff-application)
    model/types.ts
    index.ts
  features/user-management/
    api/admin-users-api.ts
    api/staff-admin-api.ts
    api/employee-admin-api.ts
    api/driver-admin-api.ts
    api/selection-api.ts
    api/adapters.ts                         ← staff/users/:id → AdminUserListItem / UserDetail
    model/query-keys.ts
    model/schemas.ts
    model/password.ts                       ← generatePassword()
    ui/RoleGate.tsx
    ui/UserRoleTag.tsx
    ui/CreateUserForm.tsx
    ui/ChangeRoleModal.tsx
    ui/DeleteUserModal.tsx
    ui/EmployeeAssignmentsForm.tsx          ← районы + склады + processingRole
    ui/DriverAssignmentsForm.tsx
    ui/ApproveApplicationModal.tsx
    ui/RejectApplicationModal.tsx
    index.ts
  pages/users/ui/UserListPage.tsx
  pages/users/ui/UserCreatePage.tsx
  pages/users/ui/UserDetailPage.tsx
  pages/users/index.ts
  pages/staff-applications/ui/StaffApplicationsPage.tsx
  pages/staff-applications/index.ts
  app/router/index.tsx                      ← маршруты
  widgets/layout/ui/MainLayout.tsx          ← меню + badge PENDING
```

`package.json` и `vite.config.ts` не меняются. Прокси `/api` уже есть.

---

## 2. Доступ и маршрутизация

### 2.1 Слои защиты

| Слой | Кто | Что делает |
|---|---|---|
| `ProtectedRoute` | все залогиненные SUPPLIER/EMPLOYEE/ADMIN | как сейчас: токен + роль панели |
| `RoleGate roles={['ADMIN']}` | ветка `/users/*` | иначе `<Navigate to="/" />` |
| `RoleGate superAdmin` | `/staff-applications`, кнопки смены роли / удаления / processingRole / вкладки CLIENT+ADMIN | иначе скрыть или редирект на `/users` |
| Сервер | middleware + контроллер | источник истины; UI не считает 403 багом, а ограничением |

`RoleGate` читает уже закэшированный `['profile']` (`getProfile`). Поле `user.admin.isSuperAdmin === true` — единственный клиентский признак суперадмина.

```tsx
interface RoleGateProps {
  roles?: UserRole[];          // default: любые из ProtectedRoute
  superAdmin?: boolean;
  fallback?: ReactNode;        // default: Navigate to="/"
  children: ReactNode;
}
```

Пока профиль грузится — тот же `Spin`, что в `ProtectedRoute`. Если `getProfile` уже в cache (layout его запрашивает), вспышки не будет.

### 2.2 Маршруты

```tsx
<Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
  {/* существующие */}
  <Route
    path="users"
    element={<RoleGate roles={['ADMIN']}><UserListPage /></RoleGate>}
  />
  <Route
    path="users/new"
    element={<RoleGate roles={['ADMIN']}><UserCreatePage /></RoleGate>}
  />
  <Route
    path="users/:userId"
    element={<RoleGate roles={['ADMIN']}><UserDetailPage /></RoleGate>}
  />
  <Route
    path="staff-applications"
    element={
      <RoleGate roles={['ADMIN']} superAdmin>
        <StaffApplicationsPage />
      </RoleGate>
    }
  />
</Route>
```

Отдельного `/users/:id/change-role` нет (решение 2).

Обычный админ, зашедший по прямой ссылке на заявки, попадает на `/users`.

### 2.3 Меню

В `MainLayout` после пункта «Склады»:

```
ADMIN            → Пользователи  (/users)
isSuperAdmin     → Заявки (/staff-applications) + Badge count из ['staff-applications-stats']
```

Статистику заявок запрашивать только если `isSuperAdmin` (`enabled: isSuperAdmin`), `staleTime: 60_000`, ошибку глотать — бейдж просто не показать.

---

## 3. Идентификаторы (обязательная карта)

Бэкенд смешивает три пространства id. Путать их — главный риск модуля.

| Имя в коде | Что это | Где встречается |
|---|---|---|
| `userId` | `User.id` | роут `/users/:userId`, `PATCH /api/admin/change-role/:userId`, `DELETE /api/admin/staff/:userId`, `DELETE /api/admin/admins/:adminId` (**это тоже userId**) |
| `employeeId` | `Employee.id` | `PUT /api/employee/:id/districts`, `PUT /api/employee/:id/warehouse`, `GET /api/employee/:id/details`, `PATCH /api/admin/employees/:employeeId/processing-role` |
| `driverId` | `Driver.id` | `GET/PUT /api/drivers/districts`, `GET/PUT /api/drivers/warehouse` (`driverId` в query/body) |
| `applicationId` | `StaffApplication.id` | approve/reject |

На карточке `UserDetail` держим все три, когда есть:

```ts
interface UserDetail {
  userId: number;
  role: UserRole;
  employeeId: number | null;   // profile.id при EMPLOYEE
  driverId: number | null;
  adminRecordId: number | null; // Admin.id, для UI не нужен в URL
  isSuperAdmin: boolean;
  // ...
}
```

Удаление:

```
if (role === 'ADMIN') DELETE /api/admin/admins/${userId}
else                  DELETE /api/admin/staff/${userId}
```

Нельзя передавать `employeeId` в `change-role` / `delete`.

---

## 4. Нормализация данных

Ответы трёх списков **несовместимы**. UI работает только с каноническими типами. Преобразование — в `adapters.ts`, не в JSX.

### 4.1 Канонические типы (`entities/user`)

Расширить текущие `User` / `Admin` / `Employee`:

```ts
export type ProcessingRole =
  | 'PICKER' | 'PACKER' | 'QUALITY_CHECKER'
  | 'COURIER' | 'SUPERVISOR' | 'MANAGER';

export interface NamedRef { id: number; name: string }

export interface Employee {
  id: number;
  userId?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  position?: string | null;
  processingRole?: ProcessingRole | null;
  warehouseId?: number | null;
  warehouse?: NamedRef | null;
  warehouses?: NamedRef[];
  districts?: NamedRef[];
}

export interface Driver {
  id: number;
  userId?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  warehouseId?: number | null;
  warehouse?: NamedRef | null;
  districts?: NamedRef[];
}

export interface Client {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  districtId?: number | null;
  district?: NamedRef | null;
}

export interface AdminUserListItem {
  userId: number;
  email: string | null;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled: boolean;
  profileCompletedAt: string | null;
  isSuperAdmin: boolean;
  displayName: string;
  contactPhone: string | null;
  profile:
    | { kind: 'ADMIN'; data: Admin }
    | { kind: 'CLIENT'; data: Client & { ordersCount?: number } }
    | { kind: 'EMPLOYEE'; data: Employee }
    | { kind: 'SUPPLIER'; data: Supplier }
    | { kind: 'DRIVER'; data: Driver }
    | { kind: 'UNKNOWN' };
}
```

`UserDetail` = `AdminUserListItem` + `loginPhone: string | null` + `lastSeenAt` + `gender` + полные назначения.

### 4.2 Адаптеры

**`GET /api/admin/users`** — уже почти канон: `id` → `userId`, `profile` по `role`, `isSuperAdmin` из `profile.isSuperAdmin`.

**`GET /api/admin/staff`** — вложенные `employee` / `supplier` / `driver`, пароль на клиент не приходит (контроллер вырезает). Собрать `profile.kind` из `role`. `twoFactorEnabled` / `profileCompletedAt` могут отсутствовать → `false` / `null`.

**`GET /api/users/:id`** — `data.user` с `phone` (вход) + `profile` + дублирующий ключ роли. Для EMPLOYEE догрузить `GET /api/employee/:employeeId/details` (склады, районы). Для DRIVER догрузить `GET /api/drivers/warehouse?driverId=` и районы, если в карточке их нет.

Параллелить карточку так:

```
useQuery(['admin-user', userId])           // GET /api/users/:id
useQuery(['employee-details', employeeId]) // enabled: role===EMPLOYEE && employeeId
useQuery(['driver-assignments', driverId]) // enabled: role===DRIVER && driverId
```

Страница мержит три результата в view-model.

### 4.3 Отображаемое имя

`entities/user/model/display-name.ts` — порт серверного `getClientDisplayName`:

```
PLACEHOLDER_CLIENT_NAME = 'Новый клиент'
INCOMPLETE_PROFILE_DISPLAY_NAME = 'Профиль не заполнен'

CLIENT && !profileCompletedAt && name === PLACEHOLDER → INCOMPLETE
иначе name | companyName | contactPerson | email | 'Без имени'
```

Контактный телефон: пустая строка, `null`, `'Не указано'` → в таблице «—».

---

## 5. API-слой

Все методы бросают `Error` с текстом `getApiMessage(err)` либо возвращают нормализованные данные. Паттерн как в `entities/user/api/profile-api.ts`.

### 5.1 `admin-users-api.ts`

```ts
getAdminUsers(params: {
  page?: number; limit?: number; search?: string;
  role?: UserRole; sortBy?: 'createdAt'|'updatedAt'|'email'|'role';
  sortOrder?: 'asc'|'desc';
}): Promise<{ items: AdminUserListItem[]; total: number; page: number; pages: number }>

getAdminStaff(params: { page?: number; limit?: number }): Promise<{ items: AdminUserListItem[]; total: number; page: number; pages: number }>

getAdminUser(userId: number): Promise<UserDetail>  // GET /api/users/:id + adapter

createAdmin(payload: CreateAdminPayload): Promise<{ userId: number }>
createStaff(payload: CreateStaffPayload): Promise<{ userId: number }>
changeUserRole(userId: number, payload: ChangeRolePayload): Promise<string> // message
deleteAdminUser(userId: number): Promise<string>
deleteStaffUser(userId: number): Promise<string>
```

После create читать `data.admin.id` / `data.staff.id` — это `User.id`.

Тело create/change-role собирать в `toCreateStaffBody` / `toChangeRoleBody`: если `allWarehouses === true`, **не** слать `warehouseId`/`warehouseIds`; пустые опциональные строки выкидывать, не слать `''`.

### 5.2 Остальные клиенты

`staff-admin-api.ts` — list / statistics / approve / reject. Approve **без** `password`.

`employee-admin-api.ts` — details, `updateDistricts(employeeId, number[])`, `updateWarehouses({ employeeId, warehouseIds, allWarehouses })`, `assignProcessingRole(employeeId, ProcessingRole)`.

`driver-admin-api.ts` — `getDistricts(driverId)`, `updateDistricts(driverId, number[])`, `getWarehouse(driverId)`, `updateWarehouse(driverId, warehouseId: number | null)`.

`selection-api.ts` — `getWarehousesForSelection()`, `getDistrictsForSelection()`. Не подменять обычным `getWarehouses()`: в селекте нужны `employeesCount` / stats.

### 5.3 Query keys

Один модуль `query-keys.ts`, без разрозненных строк:

```ts
export const userManagementKeys = {
  all: ['user-management'] as const,
  list: (p: ListParams) => [...userManagementKeys.all, 'list', p] as const,
  staff: (p: StaffListParams) => [...userManagementKeys.all, 'staff', p] as const,
  detail: (userId: number) => [...userManagementKeys.all, 'detail', userId] as const,
  employee: (id: number) => [...userManagementKeys.all, 'employee', id] as const,
  driver: (id: number) => [...userManagementKeys.all, 'driver', id] as const,
  applications: (p: AppFilters) => [...userManagementKeys.all, 'applications', p] as const,
  applicationStats: () => [...userManagementKeys.all, 'application-stats'] as const,
  warehouseSelection: () => [...userManagementKeys.all, 'warehouses-selection'] as const,
  districtSelection: () => [...userManagementKeys.all, 'districts-selection'] as const,
};
```

Инвалидация после мутаций:

| Мутация | invalidate |
|---|---|
| create / change-role / delete | `user-management` (весь корень) |
| districts/warehouse/processingRole | `detail`, `employee` или `driver` |
| approve / reject | `applications`, `application-stats`, `user-management` list |

Справочники: `staleTime: 5 * 60_000`.

Поиск в списке: локальный state + debounce 300 мс, сброс `page` на 1 при смене search/role.

---

## 6. Формы и валидация

Один набор Zod-схем в `model/schemas.ts`. Ant Design `Form` — оболочка, источник истины — `react-hook-form` + `zodResolver`, как в `ProductFormPage`.

### 6.1 Пароль

```ts
export const passwordSchema = z.string()
  .min(6, 'Пароль должен содержать минимум 6 символов')
  .regex(/[a-z]/, 'Нужна строчная буква')
  .regex(/[A-Z]/, 'Нужна заглавная буква')
  .regex(/\d/, 'Нужна цифра');
```

`generatePassword()`: 12 символов из `[A-Z][a-z][0-9]`, гарантированно по одному классу, `crypto.getRandomValues`. Кнопка подставляет значение в оба поля (пароль / подтверждение) и копирует в буфер.

Подтверждение пароля — только клиентское (`refine` равенства). На сервер уходит одно поле `password`.

### 6.2 Создание — дискриминированный union

```ts
const base = z.object({
  email: z.string().email('Введите корректный email'),
  password: passwordSchema,
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});
// superRefine: phone, если не пуст — isPhoneRu; address, если не пуст — min 5

schema = z.discriminatedUnion('role', [
  base.extend({ role: z.literal('ADMIN'), name: z.string().min(2) }),
  base.extend({
    role: z.literal('EMPLOYEE'),
    name: z.string().optional(),
    position: z.string().optional(),
    allWarehouses: z.boolean().default(false),
    warehouseIds: z.array(z.number()).default([]),
    districts: z.array(z.number()).default([]),
  }).superRefine(...склады и районы...),
  base.extend({
    role: z.literal('SUPPLIER'),
    companyName: z.string().min(2),
    contactPerson: z.string().min(2),
    inn: optionalText, ogrn, bankAccount, bik,
  }),
  base.extend({ role: z.literal('DRIVER'), name: z.string().min(2), districts: z.array(z.number()).default([]) }),
  base.extend({ role: z.literal('CLIENT'), name: z.string().min(2), districtId: z.number().optional().nullable() }),
]);
```

Смена `role` в селекте: `reset({ ...keep email/password/phone/address, role })`, чтобы не утащить `companyName` в тело EMPLOYEE.

Обычный админ: options без `ADMIN`. Если `role==='ADMIN'` — `createAdmin`, иначе `createStaff`.

### 6.3 Смена роли

Та же условная схема, **без** email/password. Добавить `isSuperAdmin: z.boolean().optional()`.

`superRefine`: `isSuperAdmin` только при `newRole==='ADMIN'`.

Предупреждение в модалке (статический текст, не с сервера):

> Текущий профиль роли будет удалён. Если у пользователя есть клиентские заказы, запись клиента в базе останется, но роль аккаунта изменится. Возвраты поставщика будут удалены. Номер входа не изменится, если он уже задан.

Switch «Суперадминистратор» скрыт, если `target.userId === currentUser.id` (нельзя снять с себя — и не предлагаем). Повышение другого админа — допустимо.

Дефолты формы: подставить `name` / `phone` / `address` / `companyName` из текущего профиля, чтобы суперадмин не заполнял заново.

### 6.4 Назначения сотрудника

Две независимые мутации, чтобы ошибка районов не откатывала склады:

1. `Select mode="multiple"` районы → `PUT /employee/:id/districts`
2. Склады: multiple + чекбокс «Все активные склады» → `PUT /employee/:id/warehouse`
3. `Select` processingRole → `PATCH .../processing-role` (только суперадмин)

После смены районов сервер **сам** ставит основной склад из первого района. После успеха — toast серверного `message` и refetch детали. В подписи к районам: «Основной склад может обновиться автоматически».

### 6.5 Заявки

Approve EMPLOYEE: обязательны `districts` и склады (`warehouseIds` или `allWarehouses`).  
Approve DRIVER: обязательны `districts`, склад опционален.  
Approve SUPPLIER: только подтверждение + предупреждение про имя компании.

Reject: `rejectionReason` min 3 символа (сервер требует непустое).

---

## 7. Экраны

Паттерн как у складов/продуктов: `Title` + фильтры справа, `Table` с `scroll.x` на мобиле, `rowKey="userId"`.

### 7.1 Список (`UserListPage`)

```
isSuperAdmin?
  да → Tabs (Все / Клиенты / Сотрудники / Поставщики / Водители / Админы)
        = query role | undefined
       Search, Table, пагинация серверная (total/pages из API)
  нет → заголовок «Персонал»
       Search по текущей странице (сервер staff не ищет) 
       Table без вкладок CLIENT/ADMIN
       Пагинация серверная
```

Для обычного админа поиск **клиентский** по `displayName`/`email` загруженной страницы — ограничение API `GET /api/admin/staff`. В подсказке плейсхолдера это не обещать как глобальный поиск. Если позже понадобится — отдельные `/api/users/employees|suppliers|drivers` (не в MVP).

Колонки: аватар (опц.), имя, роль (`UserRoleTag`), email, контакт, дата, действия.

Действия:

- Открыть — все ADMIN
- Сменить роль, Удалить — только суперадмин; скрыть Удалить если `isSuperAdmin` цели или `userId === me.id`

Кнопка «Создать» → `/users/new`.

Сортировка колонок (`createdAt`, `email`, `role`) — только в режиме суперадмина, мапится на `sortBy`/`sortOrder`.

### 7.2 Создание (`UserCreatePage`)

`Card` + `CreateUserForm`. Назад на `/users`. Query `?role=EMPLOYEE` пресетит селект.

После 201: `message.success` текста сервера, `navigate(/users/${userId})`.

Пароль в состоянии формы после ухода со страницы не хранить.

### 7.3 Карточка (`UserDetailPage`)

Шапка: аватар, `displayName`, `UserRoleTag`, бейджи «Суперадмин» / «2FA» / «Профиль не заполнен» / «Вход по SMS» (`passwordSet === false`, если поля нет — не показывать).

Описания:

| Поле | Источник | Editable |
|---|---|---|
| Email | user.email | нет |
| Номер входа | user.phone с `/api/users/:id` | нет |
| Контакт | profile.phone | нет |
| lastSeenAt | user.lastSeenAt | нет |
| Ролевые поля | profile | нет в MVP |
| Районы/склады сотрудника | employee-details | да, ADMIN |
| processingRole | employee-details | да, суперадмин |
| Районы/склад водителя | driver-assignments | да, ADMIN |

`Descriptions` + отдельные `Card` для назначений.

404 с `/api/users/:id` → «Пользователь не найден» + ссылка в список.

### 7.4 Заявки

Фильтры: статус (default `PENDING`), желаемая роль, поиск. Серверная пагинация `limit=20`.

Колонка статуса цветным `Tag`. Действия Approve/Reject только при `PENDING`.

Блок статистики сверху из `GET .../statistics` (карточки «ожидают / одобрены / отклонены»).

---

## 8. Ключевые сценарии

### 8.1 Создание сотрудника

```
Админ → CreateUserForm (role=EMPLOYEE, districts, warehouseIds)
     → POST /api/admin/staff
     → 201 { staff.id = userId }
     → invalidate list, переход на карточку
     → GET /api/users/:id + GET /api/employee/:employeeId/details
```

Ошибка «email уже существует» / «телефон уже существует» / «склады не найдены» → `message.error(getApiMessage)` без редиректа.

### 8.2 Смена роли CLIENT → EMPLOYEE

```
Суперадмин на карточке → ChangeRoleModal
  newRole=EMPLOYEE, districts[], warehouseIds[] | allWarehouses
→ PATCH /api/admin/change-role/:userId
→ 200 message
→ invalidate detail+list
```

Если у клиента были заказы, запись `Client` на сервере остаётся; в UI после refetch роль уже EMPLOYEE. Не пытаться «дочистить» клиента с фронта.

### 8.3 Удаление

```
Модалка: «Удалить {displayName} ({роль})? Действие необратимо.»
→ ADMIN: DELETE /api/admin/admins/:userId
→ иначе: DELETE /api/admin/staff/:userId
→ 200: toast + navigate /users
→ 400 про заказы: текст сервера как есть, модалку не закрывать
```

Кнопка отсутствует, если цель — суперадмин или текущий пользователь. Самоудаление через этот модуль невозможно.

### 8.4 Одобрение заявки в сотрудники

```
Модалка: склады + районы (можно пресетить districts из JSON заявки, если распарсился)
→ POST /api/admin/staff-applications/:id/approve
→ 200, инвалидация заявок и списка пользователей
```

`application.districts` на сервере — **строка JSON**. Адаптер: `JSON.parse` → `number[]`, при ошибке — пустой массив, админ выбирает руками.

---

## 9. Ошибки, пустые состояния, UX

| Ситуация | Поведение |
|---|---|
| 401 | уже обрабатывает `apiClient` → `/login` |
| 403 на действии суперадмина | `getApiMessage`, кнопка остаётся скрытой у обычного админа |
| 400 валидация | `message` + при наличии `errors[].path` подсветить поля формы (`setError`) — как идеи из `ProductFormPage.extractApiErrors` |
| 404 карточки | Empty + «К списку» |
| Пустой список | Ant `Empty` |
| Сеть | `getApiMessage` fallback «Произошла ошибка» |
| Долгая таблица | `Table loading` |

Русские подписи ролей — единственный словарь в `entities/user/model/constants.ts`. Не дублировать в страницах.

```ts
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Клиент',
  EMPLOYEE: 'Сотрудник',
  SUPPLIER: 'Поставщик',
  ADMIN: 'Администратор',
  DRIVER: 'Водитель',
};

export const PROCESSING_ROLE_LABELS: Record<ProcessingRole, string> = {
  PICKER: 'Сборщик',
  PACKER: 'Упаковщик',
  QUALITY_CHECKER: 'Контролер качества',
  COURIER: 'Курьер',
  SUPERVISOR: 'Начальник смены',
  MANAGER: 'Менеджер',
};
```

Цвета `UserRoleTag`: CLIENT blue, EMPLOYEE cyan, SUPPLIER gold, ADMIN red, DRIVER green, суперадмин — дополнительный `Tag magenta`.

---

## 10. Безопасность на клиенте

- Пароль созданного пользователя не пишем в `sessionStorage` / React Query cache.
- В логи консоли не выводить payload с `password`.
- `RoleGate` — UX, не защита: любой вызов всё равно с JWT, сервер режет.
- Не вызывать `PUT /api/profile` с чужим id — эндпоинт всегда про текущего пользователя.
- Не вызывать `POST /api/users/me/phone/change` из этого модуля.
- Список `GET /api/users/clients` (без auth на роуте) в админке не использовать.

---

## 11. Бэкенд (не в этом релизе UI, отдельным PR)

Делать только если всплывёт в приёмке.

| Патч | Зачем | Файл |
|---|---|---|
| Отдать `phone`, `passwordSet` в `GET /api/admin/users` | номер входа в таблице | `admin.controller.js` `getAllUsers` |
| `profileCompletedAt` при `createStaff` CLIENT с именем и районом | не показывать «Профиль не заполнен» у заведённого админом клиента | `createStaff` + `UserService.markProfileCompleted` |
| Поля компании в `approveStaffApplication` | нормальный поставщик из заявки | `admin.controller.js` |
| Swagger approve без `password` | не путать фронт | `admin.routes.js` |

Схема Prisma и миграции **не нужны**.

---

## 12. Тестирование приёмки (ручной прогон)

Два аккаунта: суперадмин и обычный ADMIN. Третий — SUPPLIER (меню нет).

1. Суперадмин: список, фильтр роли, поиск по email, пагинация.
2. Создание каждой роли; повторный email → 400.
3. Карточка: номер входа vs контакт; у «Новый клиент» без `profileCompletedAt` — «Профиль не заполнен».
4. Смена роли клиента в сотрудника (склады+районы) → роль в списке обновилась.
5. Попытка удалить клиента с заказами → текст с количеством.
6. Обычный админ: нет вкладок клиентов/админов, нет «сменить роль»/«удалить», создание ADMIN отсутствует, создание EMPLOYEE проходит, `/staff-applications` редиректит.
7. Заявка PENDING → approve EMPLOYEE без района → 400; с районом и складом → APPROVED.
8. Назначение складов сотрудника, «все склады», районы водителя, processingRole (только супер).
9. SUPPLIER не видит пункты меню.
10. Refresh страницы `/users/:id` с валидным токеном открывает карточку.

Автотестов в `web/` нет — не заводим инфраструктуру в MVP. Проверка — ручная + ESLint (`npm run lint`).

---

## 13. Порядок реализации (соответствует milestones спецификации)

Каждый шаг оставляет панель собираемой (`tsc -b`).

1. Типы, constants, display-name, adapters, query-keys, API-клиенты.
2. `RoleGate`, маршруты, пункты меню (страницы-заглушки).
3. `UserListPage` (оба режима).
4. `UserDetailPage` (просмотр).
5. `CreateUserForm` + `/users/new`.
6. `ChangeRoleModal`, `DeleteUserModal`.
7. Назначения сотрудника/водителя + processingRole.
8. Заявки + badge.
9. Прогон §12 двумя ролями, правки копирайта/пустых состояний.

Не начинать формы до адаптеров: иначе каждая страница заново парсит `staff` vs `profile`.

---

## 14. Что сознательно не проектируем

- Админ-редактирование ФИО/ИНН/адреса чужого профиля.
- Сброс пароля / принудительная смена `User.phone`.
- Управление сессиями, 2FA, устройствами.
- Отдельный CRUD остановок водителя и заказов клиента (только счётчики, если пришли в payload).
- Общий поиск в режиме обычного админа по всей базе.
- Новые npm-зависимости.

Эти вещи ждут API из §12 спецификации и не должны появляться «через PUT /api/profile» или прямые записи в чужой телефон.
