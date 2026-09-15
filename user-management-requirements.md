# Спецификация: управление пользователями в веб-панели

Версия: 1.0
Статус: Черновик (открытые вопросы — §16)
Стек панели: React 18 + TypeScript + Vite + Ant Design + TanStack Query + React Hook Form + Zod (FSD)
Бэкенд: уже реализован (Express + Prisma + PostgreSQL). Панель **не** дублирует серверную логику, а вызывает существующие API.

Связанные документы: `web/requirements.md` (портал поставщика), `web/tasks.md`.

---

## 1. Цель и контекст

Добавить в существующую веб-панель (`web/`, `iceberg-supplier-portal`) полноценный кабинет управления пользователями для администраторов.

Сейчас панель умеет:

| Что есть | Где |
|---|---|
| Вход ADMIN / EMPLOYEE / SUPPLIER | `features/auth`, `ProtectedRoute` допускает эти роли |
| Каталог, возвраты, отзывы, профиль | страницы `products`, `returns`, `feedbacks`, `profile` |
| Склады | пункт меню только для `ADMIN` |
| Заявка клиента «в команду» | `/client-access` → `POST /api/staff-applications/apply` |
| Свой профиль, пароль, email, аватар | `GET/PUT /api/profile`, `PUT /api/profile/password` |

Чего **нет**: списка пользователей, создания персонала/клиентов/админов, смены роли, удаления, разбора заявок, назначения районов/складов/должностей обработки.

Ключевой принцип:

> **Веб-панель — тонкий клиент к уже существующим admin/user/employee/driver API.**
> Новые серверные эндпоинты нужны только там, где текущий контракт явно не покрывает сценарий (см. §12). Смена номера входа и смена роли уже имеют жёсткие серверные инварианты — UI обязан их соблюдать, а не обходить.

---

## 2. Объём работ (Scope)

### 2.1 В объёме (MVP)

- Раздел «Пользователи» в меню (только `ADMIN`).
- Единый список пользователей с поиском, фильтром по роли, пагинацией, сортировкой — для **суперадмина**.
- Список персонала (сотрудники / поставщики / водители) — для **обычного админа**.
- Карточка пользователя (просмотр).
- Создание: администратор, сотрудник, поставщик, водитель, клиент.
- Смена роли (суперадмин) с ролезависимой формой.
- Удаление пользователя (суперадмин) с подтверждением и серверными ограничениями.
- Заявки на присоединение: список, статистика, одобрение, отклонение (суперадмин).
- Назначение районов и складов сотруднику (`ADMIN`).
- Назначение районов и склада водителю (`ADMIN`).
- Назначение `processingRole` сотруднику (суперадмин).
- Разграничение UI по `role === 'ADMIN'` и `admin.isSuperAdmin`.

### 2.2 Вне объёма (MVP, кандидаты на v2)

- Редактирование чужого профиля админом (имени, адреса, ИНН и т.д.) — **отдельного API нет**.
- Сброс пароля другого пользователя админом — **API нет**.
- Принудительная смена номера входа (`User.phone`) без подтверждения владельцем — **запрещено сервером**, не реализовывать обход.
- Самообслуживание смены телефона (`POST /api/users/me/phone/change`) — это поток текущего пользователя, не админки.
- Управление 2FA / доверенными устройствами / сессиями чужого пользователя.
- Массовые операции (csv-импорт, массовое удаление).
- Чат, заказы, остановки водителя как отдельные админ-модули (можно показать счётчики на карточке, не строить CRUD).

---

## 3. Роли, профили и идентичность

### 3.1 Роли (`UserRole`)

`CLIENT` | `EMPLOYEE` | `SUPPLIER` | `ADMIN` | `DRIVER`

У пользователя ровно одна текущая роль и один профильный ряд: `client` / `employee` / `supplier` / `admin` / `driver`.

### 3.2 Два «телефона»

Это критичный инвариант бэкенда, UI обязан его отражать.

| Поле | Смысл | Кто меняет |
|---|---|---|
| `User.phone` | Идентичность для входа (уникальный индекс, канон `+7XXXXXXXXXX`) | Сам пользователь через `POST /api/users/me/phone/change` (+ SMS / Mobile ID). Админ — **только при создании**, если номер ещё не занят. При смене роли номер записывается в `User.phone` **только если он был пуст**. |
| `*.phone` в профиле (`Client`/`Employee`/…) | Контактный номер | При создании копируется из того же номера. `PUT /api/profile` **отклоняет** смену, если новый номер отличается от `User.phone`. |

Заглушка `'Не указано'` — историческое значение обязательного поля профиля, номером не является.

### 3.3 Пароль и онбординг

- Персонал и админы создаются с email + паролем (`passwordSet` по умолчанию `true`).
- Клиенты из телефонного потока приложения могут быть без пароля (`passwordSet: false`). Таким аккаунтам UI показывает «вход по SMS», а не «забыл пароль».
- `profileCompletedAt == null` + имя клиента `'Новый клиент'` → в списках показывать **«Профиль не заполнен»**, а не заглушку из БД (`UserService.getClientDisplayName`).
- Пароль при создании: минимум 6 символов, хотя бы одна заглавная, одна строчная, одна цифра (валидаторы `admin.validator.js`).

### 3.4 Суперадмин

Флаг `Admin.isSuperAdmin`. Назначается **только** через `PATCH /api/admin/change-role/:userId` с `{ newRole: 'ADMIN', isSuperAdmin: true }`.

`POST /api/admin/admins` всегда создаёт обычного админа (`isSuperAdmin: false`).

Нельзя:

- снять суперадмина с самого себя;
- снять права у последнего суперадмина;
- удалить суперадмина (`deleteAdmin` / `deleteStaff`).

---

## 4. Матрица доступа

Источник прав: `auth.middleware.js` (`auth`, `checkRole`, `checkSuperAdmin`) + повторные проверки в контроллерах.

| Действие | Обычный ADMIN | Суперадмин | EMPLOYEE / SUPPLIER |
|---|---|---|---|
| Видеть пункт меню «Пользователи» | да (урезанный) | да (полный) | нет |
| `GET /api/admin/users` — все пользователи | 403 | да | нет |
| `GET /api/admin/staff` — персонал | да | да | нет |
| `GET /api/admin/admins` | 403 | да | нет |
| `POST /api/admin/staff` (EMPLOYEE/SUPPLIER/DRIVER/CLIENT) | да | да | нет |
| `POST /api/admin/admins` | 403 | да | нет |
| `PATCH /api/admin/change-role/:userId` | 403 | да | нет |
| `DELETE /api/admin/staff/:userId` | 403 | да | нет |
| `DELETE /api/admin/admins/:adminId` | 403 | да | нет |
| Заявки: список / approve / reject / stats | 403 | да | нет |
| `PATCH .../processing-role` | 403 | да | нет |
| Районы/склады сотрудника | да | да | нет |
| Районы/склад водителя | да | да | нет (EMPLOYEE — да, с `driverId`) |
| Справочники складов/районов для форм | да | да | нет |

`GET /api/users` (не `/admin/users`) на роуте стоит `checkRole(['ADMIN'])`, но контроллер всё равно требует суперадмина. **Для панели не использовать** — брать `GET /api/admin/users`.

`GET /api/users/:id` доступен любому авторизованному. Для карточки пользователя — ок, но страница должна быть закрыта `RoleGate` на `ADMIN`.

---

## 5. Карта существующих API (контракт для фронта)

Базовый URL: `VITE_API_BASE_URL`, пути как в таблице. Ответы: `{ status, data, message? }`. Ошибки: `{ status: 'error', message, errors? }`. Авторизация: `Authorization: Bearer <accessToken>` (уже есть в `shared/api/client.ts`).

### 5.1 Пользователи — список и карточка

| Метод | Путь | Кто | Назначение |
|---|---|---|---|
| GET | `/api/admin/users` | суперадмин | Единый список. Query: `page` (default 1), `limit` (max 50, default 10), `search`, `role` (`ADMIN\|CLIENT\|EMPLOYEE\|SUPPLIER\|DRIVER`), `sortBy` (`createdAt\|updatedAt\|email\|role`), `sortOrder` (`asc\|desc`). |
| GET | `/api/admin/staff` | ADMIN | Персонал: `EMPLOYEE` + `SUPPLIER` + `DRIVER`. Query: `page`, `limit`. |
| GET | `/api/admin/admins` | суперадмин | Все админы без пагинации. |
| GET | `/api/users/:id` | любой auth | Карточка: `id, email, role, avatar, phone, lastSeenAt, createdAt, updatedAt` + `profile` / вложенный объект роли. |
| GET | `/api/users/employees` | без жёсткой роли на роуте | Список сотрудников (пагинация, `search`, `position`). Для админки предпочтительнее `/api/employee/all`. |
| GET | `/api/users/suppliers` | любой auth | Список поставщиков. |
| GET | `/api/users/drivers` | любой auth | Список водителей с пагинацией. |
| GET | `/api/users/drivers/all` | любой auth | Все водители без пагинации (для селектов). |
| GET | `/api/users/clients` | **без auth** | Не использовать в админке как основной список (нет защиты). |

Ответ `GET /api/admin/users`:

```
data: {
  users: [{
    id, email, role, gender, avatar, createdAt, updatedAt,
    twoFactorEnabled, profileCompletedAt,
    profile: { ...поля роли }
  }],
  total, page, pages, limit
}
```

`profile` по роли:

- ADMIN: `id, name, phone, address, isSuperAdmin`
- CLIENT: `id, name, phone, address, districtId, district{id,name}, _count.orders`
- EMPLOYEE: `id, name, phone, position, processingRole, address, _count.tasks`
- SUPPLIER: `id, companyName, contactPerson, phone, address, inn, ogrn, _count.products, _count.supplies`
- DRIVER: `id, name, phone, address, districts[{id,name}], _count.stops`

**Пробел списка:** `User.phone` (номер входа) в `GET /api/admin/users` не отдаётся, только `profile.phone`. Для MVP показывать контакт из профиля; доработка бэкенда — §12.1.

### 5.2 Создание

| Метод | Путь | Кто | Тело |
|---|---|---|---|
| POST | `/api/admin/admins` | суперадмин | `{ email, password, name, phone?, address? }` → 201 `{ data.admin }` |
| POST | `/api/admin/staff` | ADMIN | `{ email, password, role, ...ролевые поля }` → 201 `{ data.staff, message }` |

`role` для staff: `EMPLOYEE | SUPPLIER | DRIVER | CLIENT`.

Общие поля staff: `email`, `password`, `phone?`, `address?`.

По роли:

| Роль | Обязательно | Опционально / условно |
|---|---|---|
| EMPLOYEE | склады (`warehouseId` **или** `warehouseIds[]` **или** `allWarehouses: true`); `districts: number[]` (min 1) | `name` (иначе «Сотрудник»), `position` (иначе «Сотрудник») |
| SUPPLIER | `companyName`, `contactPerson` | `inn`, `ogrn` (уникальны), `bankAccount`, `bik` |
| DRIVER | `name` | `districts[]` |
| CLIENT | `name` | `districtId` (на создании необязателен; при **смене роли** на CLIENT — обязателен) |

После создания бэкенд сам добавляет пользователя в BROADCAST-чаты. Панель это не делает.

Ошибки 400, которые UI должен показывать как есть: email занят, телефон занят, ИНН/ОГРН заняты, склады не найдены, «необходимо выбрать склад/район».

### 5.3 Смена роли

`PATCH /api/admin/change-role/:userId` — только суперадмин.

Тело:

```
{
  newRole: 'EMPLOYEE' | 'SUPPLIER' | 'ADMIN' | 'CLIENT' | 'DRIVER',
  isSuperAdmin?: boolean,          // только вместе с newRole=ADMIN
  name?: string,
  phone?: string,                  // заполнит User.phone, только если он пуст
  address?: string,
  // EMPLOYEE:
  position?: string,
  processingRole?: ProcessingRole,
  warehouseId?: number,
  warehouseIds?: number[],
  allWarehouses?: boolean,
  districts: number[],             // обязателен, min 1
  // SUPPLIER:
  companyName: string,
  contactPerson: string,
  inn?, ogrn?, bankAccount?, bik?,
  // CLIENT:
  districtId: number,              // обязателен
  // DRIVER:
  districts?: number[]
}
```

`ProcessingRole`: `PICKER | PACKER | QUALITY_CHECKER | COURIER | SUPERVISOR | MANAGER`.

Подписи: Сборщик / Упаковщик / Контролер качества / Курьер / Начальник смены / Менеджер.

Побочные эффекты (знать для UX-предупреждения, не дублировать в клиенте):

- старый профильный ряд удаляется;
- у сотрудника заказы отвязываются (`assignedToId = null`);
- у поставщика удаляются `productReturn`;
- клиент с заказами **не удаляется** из таблицы `Client` (запись остаётся);
- `User.phone` не перезаписывается, если уже есть.

### 5.4 Удаление

| Метод | Путь | Ограничения |
|---|---|---|
| DELETE | `/api/admin/admins/:adminId` | суперадмин; `:adminId` = **userId**; нельзя себя; нельзя суперадмина |
| DELETE | `/api/admin/staff/:userId` | суперадмин; фактически удаляет **любую** роль, кроме суперадмина; 400 если у связанного Client есть заказы |

Подтверждение в UI обязательно. Текст ошибки сервера показывать без перефразирования (там уже есть число заказов).

Самоудаление своего аккаунта (`DELETE /api/profile` + пароль) — не часть этого модуля.

### 5.5 Заявки на присоединение

Уже есть клиентская подача. Админская обработка:

| Метод | Путь | Query / тело |
|---|---|---|
| GET | `/api/admin/staff-applications` | `page, limit (max 50, default 20), status (PENDING\|APPROVED\|REJECTED), desiredRole (EMPLOYEE\|SUPPLIER\|DRIVER), search` |
| GET | `/api/admin/staff-applications/statistics` | сводка по статусам и ролям |
| POST | `/api/admin/staff-applications/:id/approve` | EMPLOYEE: `position?, warehouseId \| warehouseIds \| allWarehouses, districts[]` (склады и районы обязательны). DRIVER: `districts[]` обязательны, `warehouseId?`. SUPPLIER: доп. поля не требуются (компания берётся из имени клиента). |
| POST | `/api/admin/staff-applications/:id/reject` | `{ rejectionReason }` обязательно |

Swagger для approve упоминает `password` — **контроллер пароль не принимает** (остаётся текущий). UI пароль не спрашивает.

### 5.6 Сотрудники: районы, склады, должности

| Метод | Путь | Кто | Тело / query |
|---|---|---|---|
| GET | `/api/employee/all` | ADMIN, EMPLOYEE | `page, limit, search, position, districtId` |
| GET | `/api/employee/:id/details` | ADMIN, EMPLOYEE | деталь сотрудника (**id = employee.id, не userId**) |
| PUT | `/api/employee/:id/districts` | ADMIN | `{ districts: number[] }`. Побочный эффект: подставляет основной склад из первого района, если найден. |
| PUT | `/api/employee/:id/warehouse` | ADMIN | `{ warehouseIds?: number[], warehouseId?: number, allWarehouses?: boolean }`. Первый id → `warehouseId`, все → `warehouses`. |
| GET | `/api/admin/employees/processing-roles` | ADMIN | `page, limit, search, processingRole` |
| PATCH | `/api/admin/employees/:employeeId/processing-role` | суперадмин | `{ processingRole }` |

### 5.7 Водители: районы и склад

`:driverId` везде — **id записи Driver, не User**.

| Метод | Путь | Кто | Заметки |
|---|---|---|---|
| GET | `/api/drivers/districts?driverId=` | ADMIN | районы водителя |
| PUT | `/api/drivers/districts` | ADMIN | `{ districts: number[], driverId }` |
| GET | `/api/drivers/warehouse?driverId=` | ADMIN | склад или `null` |
| PUT | `/api/drivers/warehouse` | ADMIN | `{ warehouseId: number \| null, driverId }` — `null` отвязывает |

Остановки водителя (`GET /api/users/drivers/:id/stops`) в MVP не обязательны; на карточке достаточно `_count.stops`.

### 5.8 Справочники для форм

| Метод | Путь | Кто |
|---|---|---|
| GET | `/api/admin/warehouses/selection` | ADMIN | активные склады + район + `employeesCount`. Query: `includeInactive=true` при необходимости |
| GET | `/api/admin/districts/selection` | ADMIN | районы + stats (склады/клиенты/водители/сотрудники) |
| GET | `/api/districts` | уже используется в панели, без auth | fallback, если selection не нужен со статистикой |

В панели уже есть `getDistricts()` и `getWarehouses()`. Для админ-форм предпочтительны `/selection` — там есть счётчики, удобные в селекте.

### 5.9 Что сознательно не вызывать из админки пользователей

- `PUT /api/profile` — это **свой** профиль.
- `POST /api/users/me/phone/change` и `.../confirm` — смена номера **текущего** пользователя.
- `DELETE /api/profile` — самоудаление.
- Публичный `GET /api/users/clients` как основной реестр клиентов.

---

## 6. Функциональные требования

| ID | Требование |
|---|---|
| FR-1 | Суперадмин открывает реестр всех пользователей с поиском, фильтром роли, сортировкой и пагинацией. |
| FR-2 | Обычный админ видит персонал (сотрудники/поставщики/водители) и может создавать staff, но не видит полный реестр, не меняет роли, не удаляет, не разбирает заявки. |
| FR-3 | В таблице видны: отображаемое имя, роль, email, контактный телефон, дата создания, бейджи (суперадмин, 2FA, «профиль не заполнен»). |
| FR-4 | Поиск работает по email, имени, компании, должности, ИНН, районам (как на бэкенде). |
| FR-5 | Карточка пользователя показывает идентичность (`email`, `User.phone` с `/api/users/:id`), профиль роли, район(а), склады, счётчики (заказы/товары/остановки). |
| FR-6 | Создание пользователя — одна форма с переключением роли и условными полями; клиентская валидация совпадает с `admin.validator.js`. |
| FR-7 | Создать администратора может только суперадмин; новый админ всегда обычный. |
| FR-8 | Смена роли — модалка/страница с полями целевой роли и явным предупреждением о потере старого профиля. |
| FR-9 | Нельзя в UI предложить снять суперадмина с себя или с последнего суперадмина; при 403/400 показать `message` сервера. |
| FR-10 | Удаление — модалка подтверждения (имя + роль). Блок при заказах клиента. Не показывать кнопку удаления на суперадмине и на себе. |
| FR-11 | Раздел заявок: фильтры статус/роль/поиск, статистика, approve с формой складов/районов, reject с причиной. |
| FR-12 | На карточке сотрудника: редактирование районов, складов (мультивыбор + «все активные склады»), должности обработки (суперадмин). |
| FR-13 | На карточке водителя: районы и склад (можно отвязать). |
| FR-14 | Пункт меню и все маршруты `/users/*`, `/staff-applications` закрыты ролью ADMIN; действия суперадмина дополнительно скрыты и защищены сервером. |
| FR-15 | После мутаций инвалидировать соответствующие query keys (список, карточка, заявки, сотрудник). |
| FR-16 | Сообщения об ошибках — из `message` / `errors[].msg` бэкенда (уже есть `getApiMessage`). |
| FR-17 | Интерфейс на русском. |

---

## 7. Экраны и маршруты

Расширение текущего роутера (`app/router/index.tsx`) и меню (`widgets/layout`).

```
/users                          список (суперадмин — все; обычный админ — персонал)
/users/new                      создание (query ?role= для пресета)
/users/:userId                  карточка
/users/:userId/change-role      смена роли (только суперадмин; можно модалкой на карточке)
/staff-applications             заявки (только суперадмин)
```

Меню:

- «Пользователи» — `ADMIN`
- «Заявки» — только `admin.isSuperAdmin`, бейдж с числом `PENDING` из statistics

`ProtectedRoute` сейчас пускает SUPPLIER/EMPLOYEE/ADMIN. Для новых страниц — вложенный `RoleGate`:

- `roles={['ADMIN']}` для списка/создания/карточки;
- `superAdmin` для заявок, смены роли, удаления, processingRole, полного реестра.

Обычный админ на `/users`: тот же layout, источник данных `GET /api/admin/staff`, без вкладок CLIENT/ADMIN, без кнопок «сменить роль» / «удалить». Кнопка «Создать» есть, но в селекте роли нет `ADMIN`.

### 7.1 Список

Ant Design `Table` + `Input.Search` + `Select` роли + сортировка колонок, совпадающая с `sortBy`.

Колонки: аватар, имя (см. §3.3), роль (Tag), email, телефон профиля, дата, действия (открыть / сменить роль / удалить — по правам).

Вкладки-фильтры (суперадмин): Все / Клиенты / Сотрудники / Поставщики / Водители / Админы. Вкладка = query `role`.

Пустое состояние, скелетон/`Spin`, ошибка с повтором.

### 7.2 Создание

Одна страница, `role` — первый контрол. Дальше условные блоки (React Hook Form + Zod `superRefine` по роли).

Справочники: `GET /api/admin/districts/selection`, `GET /api/admin/warehouses/selection`.

Для сотрудника:

- мультивыбор складов;
- чекбокс «Все активные склады» → `allWarehouses: true` (тогда id не слать);
- мультивыбор районов (обязательно).

Пароль: поле + генератор опционально (кнопка «сгенерировать» копирует в буфер) — удобство, не требование бэкенда.

После 201 — toast `message` сервера и переход на карточку (`staff.id` / `admin.id`).

### 7.3 Карточка

Шапка: имя, роль, суперадмин-бейдж, 2FA, «профиль не заполнен», lastSeen.

Блоки по роли. Действия в `Space`/`Dropdown` по матрице §4.

Сотрудник: отдельные формы «Районы», «Склады», «Должность обработки».
Водитель: «Районы», «Склад».

Не строить редактирование ФИО/компании, пока нет admin-update API (§12.2).

### 7.4 Смена роли

Предупреждение: «Текущий профиль роли будет удалён. Клиент с заказами сохранится в базе, но роль пользователя изменится».

Форма = те же условные поля, что при создании целевой роли. `isSuperAdmin` — Switch, только если `newRole === ADMIN`.

Нельзя выбрать снятие суперадмина, если `target.id === currentUser.id`.

### 7.5 Заявки

Таблица: дата, имя/email/телефон заявителя, желаемая роль, статус, причина/опыт.

Approve: модалка. Для EMPLOYEE — склады+районы (как при создании). Для DRIVER — районы (+ опц. склад). Для SUPPLIER — подтверждение без доп. реквизитов (бэкенд подставит имя клиента как компанию).

Reject: обязательная причина.

---

## 8. Клиентская архитектура (FSD)

Не ломать текущие слои. Добавить слайсы рядом с уже существующими `entities/user`, `features/staff-application`, `entities/district`, `entities/warehouse`.

```
src/
  entities/user/                 # расширить types.ts: Driver, Client, AdminUserListItem, ProcessingRole
  entities/staff-application/    # вынести типы заявки из features (админ + клиент)
  features/user-management/
    api/admin-users-api.ts       # admin users/staff/admins/change-role/delete
    api/staff-admin-api.ts       # applications + statistics + approve/reject
    api/employee-admin-api.ts    # districts, warehouse, processing-role
    api/driver-admin-api.ts      # districts, warehouse
    model/schemas.ts             # Zod: createAdmin, createStaff, changeRole, approve, reject
    ui/RoleGate.tsx
    ui/UserRoleTag.tsx
    ui/ChangeRoleForm.tsx
    ui/CreateUserForm.tsx
    ui/DeleteUserModal.tsx
  pages/users/
    ui/UserListPage.tsx
    ui/UserCreatePage.tsx
    ui/UserDetailPage.tsx
  pages/staff-applications/
    ui/StaffApplicationsPage.tsx
  widgets/layout/                # пункты меню + бейдж заявок
```

Импорты только вниз по FSD. Публичный API слайса — `index.ts`.

Query keys (предложение):

```
['admin-users', { page, limit, search, role, sortBy, sortOrder }]
['admin-staff', { page, limit }]
['admin-user', userId]
['staff-applications', filters]
['staff-applications-stats']
['employee-details', employeeId]
['warehouses-selection']
['districts-selection']
```

---

## 9. Типы (минимум для `entities/user`)

Расширить текущие `User`, `Admin`, `Employee` (сейчас нет `processingRole`, `districts`, `warehouses`).

```ts
export type ProcessingRole =
  | 'PICKER' | 'PACKER' | 'QUALITY_CHECKER'
  | 'COURIER' | 'SUPERVISOR' | 'MANAGER';

export interface AdminUserListItem {
  id: number;
  email: string | null;
  role: UserRole;
  gender: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled: boolean;
  profileCompletedAt: string | null;
  profile: AdminProfile | ClientProfile | EmployeeProfile | SupplierProfile | DriverProfile | null;
}
```

Отображаемое имя:

1. CLIENT + нет `profileCompletedAt` + `name === 'Новый клиент'` → «Профиль не заполнен»
2. иначе `profile.name` / `companyName` / email / «Без имени»

---

## 10. Валидация на клиенте (зеркало сервера)

Пароль: `min(6)`, `/[a-z]/`, `/[A-Z]/`, `/\d/`.

Email: обязателен при создании через admin API (сервер ищет уникальность по email).

Телефон: опционален; если задан — канонизация как в панели (`isPhone` / `isPhoneRu`). Сервер нормализует через `phoneSanitizer`.

Адрес: если задан — минимум 5 символов.

Имя: минимум 2 символа, где сервер требует.

EMPLOYEE: хотя бы один склад (id или `allWarehouses`) **и** хотя бы один район.

SUPPLIER: `companyName`, `contactPerson`.

DRIVER create: `name`. DRIVER approve-application: районы обязательны.

CLIENT change-role: `districtId` обязателен. CLIENT create: `name` обязателен, район нет.

`isSuperAdmin === true` только при `newRole === 'ADMIN'`.

---

## 11. Нефункциональные требования

| Категория | Требование |
|---|---|
| Безопасность | Действия суперадмина скрыты в UI **и** опираются на 403 сервера. Не хранить пароли созданных пользователей после показа одноразового значения. |
| UX | Русский язык. Подтверждения на удаление и смену роли. Понятные 400 (занятый email/телефон, заказы клиента). |
| Адаптив | Таблица со горизонтальным скроллом на узком экране; формы в одну колонку (как склады/продукты). |
| Производительность | `limit` ≤ 50. Справочники районов/складов кэшировать React Query (`staleTime` ~ 5 мин). |
| Согласованность | Стиль Ant Design как у продуктов/складов. Ошибки через `message`/`Alert` + `getApiMessage`. |
| Наблюдаемость | Не логировать пароли. |

`vite.config.ts` уже проксирует `/api` и `/uploads` при `VITE_DEV_API_PROXY_TARGET`. Новые пути не требуют изменений конфига.

---

## 12. Зависимости от бэкенда

MVP **можно** собрать на текущих эндпоинтах. Ниже — желательные доработки, не блокирующие старт UI.

### 12.1 Рекомендуется до начала или сразу после MVP (маленькие)

1. **`GET /api/admin/users`: отдать `phone`, `passwordSet`, `phoneVerifiedAt`.** Сейчас номер входа не виден в реестре, только контакт профиля.
2. **`GET /api/admin/users` и карточка сотрудника:** в список не входят `districts` / `warehouses` сотрудника — для таблицы не нужно, на карточке брать `GET /api/employee/:id/details` и `GET /api/users/:id`.
3. Исправить swagger `POST .../approve`: убрать обязательный `password` (контроллер его не читает).

### 12.2 v2 (без этих API в MVP не делать экраны)

| Пробел | Зачем | Предложение |
|---|---|---|
| Нет `PUT /api/admin/users/:id` | Админ не может поправить ФИО, адрес, реквизиты поставщика | Новый эндпоинт с проверкой суперадмина/админа; **не** менять `User.phone` |
| Нет admin password reset | Сотрудник забыл пароль | Отдельный поток с аудитом; инвалидация refresh-токенов как в `changePassword` |
| Нет admin-смены номера входа | Сознательно | Оставить self-service `phoneChange`; админ не должен писать в `User.phone` поверх существующего |
| `createStaff` не ставит `profileCompletedAt` | Клиент, созданный админом с именем, всё ещё «не заполнен», если нет района | На сервере: если `name` реальное и (для CLIENT) есть `districtId` — проставить `profileCompletedAt` |
| Approve SUPPLIER без ИНН/компании | Профиль-заглушка из имени клиента | В модалке approve дать поля `companyName`, `contactPerson`, `inn` и прокинуть в контроллер (потребует правки сервера) |

### 12.3 Не lagать / не обходить

- Смена `User.phone` через `updateProfile` — сервер отвечает «Чтобы сменить номер входа, подтвердите новый номер».
- Создание суперадмина через `POST /api/admin/admins` — флаг игнорируется, всегда `false`.

---

## 13. Этапы внедрения

1. **M1 — Каркас.** Типы, API-клиенты, `RoleGate`, пункт меню, пустые страницы, разделение super/ordinary.
2. **M2 — Реестр.** Таблица суперадмина (`/api/admin/users`) + таблица персонала для обычного админа (`/api/admin/staff`). Поиск, фильтр, пагинация.
3. **M3 — Карточка.** `GET /api/users/:id` + детали сотрудника/водителя.
4. **M4 — Создание.** Формы admin/staff + справочники selection.
5. **M5 — Смена роли и удаление.** Только суперадмин.
6. **M6 — Районы/склады/processingRole.** Сотрудник и водитель.
7. **M7 — Заявки.** Список, статистика, approve/reject, бейдж в меню.
8. **M8 — Полировка.** Пустые/ошибки, адаптив, прогон прав обычного админа vs суперадмина.

---

## 14. Критерии приёмки

- AC-1: Суперадмин видит всех пользователей, фильтрует по роли, ищет по email/имени/компании.
- AC-2: Обычный админ не открывает полный реестр (403 или редирект), создаёт сотрудника/поставщика/водителя/клиента, не создаёт админа.
- AC-3: Создание сотрудника без района или склада невозможно (клиентская + серверная валидация).
- AC-4: Создание с занятым email/телефоном показывает сообщение сервера, пользователь не создаётся.
- AC-5: Смена роли CLIENT → EMPLOYEE требует склады и районы; после успеха в списке роль обновлена.
- AC-6: Снять с себя суперадмина нельзя (кнопка недоступна и/или 403).
- AC-7: Удаление клиента с заказами даёт 400 с количеством заказов, запись остаётся.
- AC-8: Удаление суперадмина недоступно.
- AC-9: Заявка PENDING одобряется в сотрудника только после выбора складов и районов; статус становится APPROVED, роль пользователя меняется.
- AC-10: Отклонение без причины невозможно.
- AC-11: SUPPLIER/EMPLOYEE не видят пункт «Пользователи».
- AC-12: Клиент с незаполненным профилем отображается как «Профиль не заполнен», а не «Новый клиент».
- AC-13: В UI нет поля «сменить номер входа» у чужого пользователя.
- AC-14: Назначение `processingRole` обычному админу недоступно (скрыто + 403).

---

## 15. Риски

| Риск | Митигация |
|---|---|
| Путаница `userId` vs `employee.id` vs `driver.id` vs `adminId` | В API и типах явно именовать; в путях deleteAdmin параметр — userId. |
| Обычный админ видит кнопки суперадмина | `RoleGate` + сервер. Тест двумя аккаунтами. |
| Смена роли уничтожает профиль поставщика (товары/возвраты) | Предупреждение в диалоге; возвраты сервер удаляет сам. |
| Админ пытается «поправить телефон» через профиль | Не делать такой формы; в карточке подписать поле как контакт / номер входа отдельно. |
| `GET /api/users/:id` доступен не-админам на API | Страница всё равно за `RoleGate`; не светить ссылки. |
| Список staff без поиска | Для обычного админа — клиентская фильтрация текущей страницы или фильтр `role` через отдельные `/api/users/employees` и т.д. Зафиксировать в реализации: либо пагинация как есть, либо role-specific endpoints. |

---

## 16. Открытые вопросы

1. **Обычный админ и клиенты.** Сейчас полный список клиентов — только у суперадмина. Нужен ли обычному админу просмотр клиентов (через отдельный защищённый endpoint)? Рекомендация MVP: нет.
2. **Смена роли — страница или модалка?** Рекомендация: модалка с широкой формой на карточке, чтобы не терять контекст.
3. **Создание суперадмина.** Только через change-role существующего ADMIN. Нужен ли чекбокс при создании админа (потребует правки `createAdmin`)? Рекомендация MVP: нет, два шага (создать → повысить).
4. **Approve поставщика.** Оставляем заглушку компании из имени клиента или сразу делаем поля + доработку сервера? Рекомендация: поля в UI, если бэкенд их проигнорирует — не слать до 12.2; либо маленький патч сервера в том же релизе.
5. **Генерация пароля при создании.** Показывать один раз и копировать, или слать пароль на email (отдельный сервис)? Рекомендация MVP: показать + копировать.
6. **Нужен ли обычный админ на `/users/new` с ролью CLIENT?** API позволяет. Рекомендация: да, чтобы заводить тестовых/офлайн клиентов с email+паролем.

---

## 17. Сводка: что трогаем в `web/`

| Файл / зона | Изменение |
|---|---|
| `src/app/router/index.tsx` | маршруты `/users`, `/users/new`, `/users/:userId`, `/staff-applications` |
| `src/widgets/layout/ui/MainLayout.tsx` | меню «Пользователи», «Заявки» + badge |
| `src/entities/user/model/types.ts` | роли, профили, list item |
| `src/features/user-management/**` | новый слайс |
| `src/pages/users/**`, `src/pages/staff-applications/**` | страницы |
| `src/features/auth/ui/protected-route.tsx` | не расширять ALLOWED_ROLES; доступ к модулю — через `RoleGate` |
| `package.json`, `vite.config.ts` | без изменений |

Бэкенд в MVP не обязателен к изменению, кроме желательных пунктов §12.1.
