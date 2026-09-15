# План задач: управление пользователями в веб-панели

План выполнения `web/user-management-requirements.md` по решениям из `web/user-management-design.md`.

Существующий `web/tasks.md` — портал поставщика, его не расширяем. Этот файл — отдельный трек.

**Архитектура: FSD.** Импорты только вниз. Публичный API слайса — `index.ts`. Страницы не вызывают axios: только `features/user-management/api` и `entities/*`.

**Ограничения MVP (не делать в задачах ниже):** редактирование чужого профиля, сброс пароля, смена `User.phone` админом, новые npm-зависимости, правки бэкенда (кроме фазы B, по желанию после UI).

Каждая фаза оставляет `npm run build` (`tsc -b && vite build`) зелёным.

---

## Фаза 0: Доменная модель

Без UI. Нужна, чтобы формы и таблицы не парсили сырой JSON каждый по-своему.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 0.1 | Расширить типы пользователя | В `entities/user/model/types.ts`: `ProcessingRole`, `NamedRef`, `Driver`, `Client`; расширить `Employee` (`processingRole`, `districts`, `warehouses`, `warehouse`); `AdminUserListItem`, `UserDetail` (поля `userId`, `employeeId`, `driverId`, `loginPhone`, `isSuperAdmin`) по design §3–§4. Экспорт из `entities/user/index.ts`. | — |
| 0.2 | Словари подписей | `entities/user/model/constants.ts`: `USER_ROLE_LABELS`, `PROCESSING_ROLE_LABELS`. Один источник, без дублирования в страницах. | 0.1 |
| 0.3 | Отображаемое имя | `entities/user/model/display-name.ts`: порт `getClientDisplayName` — `'Новый клиент'` + пустой `profileCompletedAt` → «Профиль не заполнен»; иначе name / companyName / contactPerson / email / «Без имени». Контакт `'Не указано'` / пустая строка → `null`. | 0.1 |
| 0.4 | Типы заявок в entity | Вынести `StaffApplication`, роли/статусы из `features/staff-application/api/staff-application-api.ts` в `entities/staff-application/model/types.ts`. Клиентская подача продолжает импортировать оттуда. Админский API заявки **не** класть в этот слайс. | — |

---

## Фаза 1: API-клиент и адаптеры

Не начинать страницы, пока списки не нормализуются в `AdminUserListItem`.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 1.1 | Query keys | `features/user-management/model/query-keys.ts` — фабрика `userManagementKeys` (list, staff, detail, employee, driver, applications, stats, selections) по design §5.3. | — |
| 1.2 | Адаптеры ответов | `features/user-management/api/adapters.ts`: `adminUsersRowToItem`, `adminStaffRowToItem`, `userByIdToDetail`. `id` списка → `userId`. Карта id: `employeeId` / `driverId` из `profile.id` при соответствующей роли. `DELETE /admins/:adminId` всегда получает `userId`. | 0.1, 0.3 |
| 1.3 | API пользователей | `admin-users-api.ts`: `getAdminUsers` → `GET /api/admin/users`; `getAdminStaff` → `GET /api/admin/staff`; `getAdminUser` → `GET /api/users/:id`; `createAdmin`, `createStaff`, `changeUserRole`, `deleteAdminUser`, `deleteStaffUser`. Тела: пустые строки не слать; при `allWarehouses: true` не слать `warehouseId`/`warehouseIds`. Ошибки через `getApiMessage`. | 1.2 |
| 1.4 | API сотрудника / водителя / справочников | `employee-admin-api.ts`: details, districts, warehouse, processing-role (`employeeId`). `driver-admin-api.ts`: districts/warehouse (`driverId` в query/body). `selection-api.ts`: `GET /api/admin/warehouses/selection`, `GET /api/admin/districts/selection` (не подменять `getWarehouses()`). | 0.1 |
| 1.5 | API заявок (админ) | `staff-admin-api.ts`: list, statistics, approve (**без** password), reject. Парсинг `application.districts` из JSON-строки → `number[]`, при ошибке `[]`. | 0.4 |
| 1.6 | Публичный API слайса | `features/user-management/index.ts`: экспортировать типы, keys, функции API. Страницы импортируют только отсюда и из `entities/user`. | 1.1–1.5 |

---

## Фаза 2: Каркас доступа и навигация

Заглушки страниц, чтобы меню уже вело на живые роуты.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 2.1 | `RoleGate` | `features/user-management/ui/RoleGate.tsx`: читает `['profile']`; `roles={['ADMIN']}` и/или `superAdmin`; пока грузится — `Spin`; иначе `Navigate to="/"`. `ProtectedRoute` **не** менять. | 0.1 |
| 2.2 | Заглушки страниц | `UserListPage`, `UserCreatePage`, `UserDetailPage`, `StaffApplicationsPage` — Title + «В разработке». Экспорт из `pages/*/index.ts`. | — |
| 2.3 | Маршруты | В `app/router/index.tsx` внутри `MainLayout`: `/users`, `/users/new`, `/users/:userId` за `RoleGate ADMIN`; `/staff-applications` за `RoleGate ADMIN + superAdmin`. Отдельного `/change-role` нет. | 2.1, 2.2 |
| 2.4 | Меню | В `MainLayout`: пункт «Пользователи» для `ADMIN`; «Заявки» только при `admin.isSuperAdmin`. Badge заявок — в фазе 8, пока без счётчика. Склады/продукты не трогать. | 2.3 |

Проверка фазы: под ADMIN открывается `/users`; под SUPPLIER пункта нет и прямой URL уводит на `/`; обычный ADMIN с `/staff-applications` уходит на `/`.

---

## Фаза 3: Список пользователей

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 3.1 | `UserRoleTag` | Цвета по design §9. Доп. magenta-tag «Суперадмин». | 0.2 |
| 3.2 | Режим суперадмина | `UserListPage`: `GET /api/admin/users`. Tabs = `role` query (Все / CLIENT / EMPLOYEE / SUPPLIER / DRIVER / ADMIN). Search с debounce 300 мс, сброс page=1. Серверная пагинация `limit=10`. Сортировка колонок `createdAt` / `email` / `role`. | 1.3, 2.3, 3.1 |
| 3.3 | Режим обычного админа | Тот же компонент, `enabled` от `isSuperAdmin`: `GET /api/admin/staff`. Без вкладок CLIENT/ADMIN. Поиск только по загруженной странице (ограничение API). Кнопки «Сменить роль» / «Удалить» скрыты. | 3.2 |
| 3.4 | Колонки и пустые состояния | Имя через `display-name`, email, контакт, дата, роль, действия «Открыть». `Empty`, `Table loading`, ошибка с `getApiMessage`. Кнопка «Создать» → `/users/new`. Горизонтальный `scroll.x` на мобиле — как склады. | 3.2, 3.3 |

AC: FR-1, FR-2, FR-3, FR-4, FR-12 (имя «Профиль не заполнен»), AC-1, AC-2 (часть: список), AC-11.

---

## Фаза 4: Карточка (просмотр)

Назначения (районы/склады) — фаза 7. Здесь только чтение.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 4.1 | Загрузка карточки | `UserDetailPage`: `GET /api/users/:id`. Для EMPLOYEE — дополнительно `GET /api/employee/:employeeId/details` (`enabled` по id). Для DRIVER — districts/warehouse. Merge в view-model. 404 → Empty + ссылка в список. | 1.3, 1.4, 2.3 |
| 4.2 | Шапка и описания | `displayName`, роль, бейджи суперадмин / 2FA / «Профиль не заполнен» / «Вход по SMS» только если `passwordSet === false` (если поля нет — не показывать). `Descriptions`: email, **номер входа** (`loginPhone`), **контакт** (`profile.phone`) — оба read-only. lastSeen. Ролевые поля (компания, ИНН, район клиента, счётчики) без инпутов. | 4.1, 0.3 |
| 4.3 | Кнопки действий (пока скрытая логика) | «Сменить роль» / «Удалить» рендерить только суперадмину; скрыть удаление для себя и для суперадмина-цели. Обработчики — заглушка до фазы 6. «Назначить суперадмином» — только если цель ADMIN и не супер (фаза 6). | 4.2 |

AC: FR-5, AC-13, AC-3 карточки (два телефона).

---

## Фаза 5: Создание пользователя

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 5.1 | Генератор пароля | `features/user-management/model/password.ts`: 12 символов, гарантированно a-z + A-Z + цифра, `crypto.getRandomValues`. Не класть пароль в React Query. | — |
| 5.2 | Zod-схемы создания | `model/schemas.ts`: `passwordSchema` как на сервере (min 6, верх/низ/цифра); `discriminatedUnion` по `role` (ADMIN / EMPLOYEE / SUPPLIER / DRIVER / CLIENT) по design §6.2. EMPLOYEE: район обязателен + склад или `allWarehouses`. | 0.1 |
| 5.3 | Справочники в форме | `useQuery` selection складов и районов, `staleTime` 5 мин. Чекбокс «Все активные склады». Смена роли в селекте — `reset` с сохранением email/password/phone/address. | 1.4, 5.2 |
| 5.4 | `CreateUserForm` + страница | RHF + Ant Design, как `ProductFormPage`. Обычный админ: в селекте нет ADMIN. Query `?role=` пресетит. ADMIN → `createAdmin`, иначе `createStaff`. Успех: toast `message` сервера, переход на `/users/:userId`. 400: `getApiMessage`, без редиректа; `errors[].path` → `setError`. Кнопка «Сгенерировать» + «Скопировать». | 5.1–5.3, 2.3 |

AC: FR-6, FR-7, FR-16, AC-2 (создание без ADMIN у обычного админа), AC-3, AC-4.

---

## Фаза 6: Смена роли и удаление

Только суперадмин. Модалка на карточке, не отдельный роут.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 6.1 | Схема смены роли | В `schemas.ts`: те же условные поля, без email/password; `isSuperAdmin` только при `newRole==='ADMIN'`. CLIENT → обязателен `districtId`. Дефолты из текущего профиля. | 5.2 |
| 6.2 | `ChangeRoleModal` | Ширина ≥ 720. Предупреждение про удаление профиля / заказы клиента / возвраты поставщика / неизменность номера входа (design §6.3). Switch суперадмина скрыт, если `target.userId === me.id`. Успех: invalidate `user-management`, закрыть модалку, toast. С карточки ADMIN: действие «Назначить суперадмином» = тот же PATCH с `newRole: 'ADMIN', isSuperAdmin: true` (решение design №3). | 6.1, 4.3 |
| 6.3 | `DeleteUserModal` | Текст: имя + роль. `role==='ADMIN'` → `DELETE /api/admin/admins/:userId`, иначе `DELETE /api/admin/staff/:userId`. 200: toast + `/users`. 400 (заказы): сообщение сервера как есть, модалку не закрывать. Кнопки нет на себе и на суперадмине. | 1.3, 4.3 |

AC: FR-8, FR-9, FR-10, AC-5, AC-6, AC-7, AC-8.

---

## Фаза 7: Районы, склады, должность обработки

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 7.1 | Назначения сотрудника | `EmployeeAssignmentsForm` на карточке EMPLOYEE. Районы → `PUT /api/employee/:employeeId/districts` (подсказка: основной склад может смениться сам). Склады + «все активные» → `PUT .../warehouse`. После успеха refetch details. | 1.4, 4.1 |
| 7.2 | `processingRole` | Select на карточке сотрудника. Виден всем ADMIN, **изменяется** только суперадмином (`PATCH /api/admin/employees/:employeeId/processing-role`). Обычный админ видит подпись read-only. | 7.1, 0.2 |
| 7.3 | Назначения водителя | `DriverAssignmentsForm`: районы `PUT /api/drivers/districts` + `{ driverId }`; склад `PUT /api/drivers/warehouse`, `warehouseId: null` = отвязать. | 1.4, 4.1 |

AC: FR-12, FR-13, AC-14.

---

## Фаза 8: Заявки на присоединение

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 8.1 | Список и статистика | `StaffApplicationsPage`: карточки stats; таблица с фильтрами `status` (default PENDING), `desiredRole`, search; пагинация `limit=20`. Колонки: дата, имя/email/телефон, роль, статус Tag, причина/опыт. | 1.5, 2.3 |
| 8.2 | Approve | Модалка. EMPLOYEE: склады + районы (пресет из распарсенного JSON заявки). DRIVER: районы обязательны, склад опционален. SUPPLIER: подтверждение + предупреждение, что компания = имя клиента (design решение №4). Без поля password. | 8.1, 5.3 |
| 8.3 | Reject | Модалка, `rejectionReason` обязателен. Кнопки Approve/Reject только у `PENDING`. | 8.1 |
| 8.4 | Badge в меню | `useQuery` `applicationStats`, `enabled: isSuperAdmin`, `staleTime: 60s`. Badge = число PENDING. Ошибку глотать — пункт без цифры. Invalidate stats после approve/reject. | 8.1, 2.4 |

AC: FR-11, AC-9, AC-10.

---

## Фаза 9: Полировка и приёмка

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 9.1 | Ошибки и пустые состояния | Пройти все новые страницы: Empty, 404, 403 toast, сеть. Русские тексты кнопок/плейсхолдеров. | 3–8 |
| 9.2 | Адаптив | Таблицы со `scroll.x` на `!md`; формы в одну колонку; модалка смены роли на узком экране на всю ширину. Как склады/продукты. | 3–8 |
| 9.3 | ESLint + сборка | `npm run lint`, `npm run build` в `web/`. Нет импортов вверх по FSD, нет axios в pages. | 9.1 |
| 9.4 | Ручной прогон AC | Чеклист design §12 двумя аккаунтами (суперадмин, обычный ADMIN) + SUPPLIER (меню скрыто). Refresh `/users/:id` с токеном. Зафиксировать баги и закрыть их здесь же, не открывая v2-скоуп. | 9.1–9.3 |

Соответствие приёмке спецификации §14: AC-1…AC-14.

---

## Фаза B: бэкенд (не блокирует UI, отдельный PR)

Делать только если всплыло на 9.4 или отдельно попросили.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| B.1 | `GET /api/admin/users` + `phone`, `passwordSet` | `admin.controller.js` `getAllUsers`. Таблица сможет показать номер входа. | UI фазы 3 уже работает с `profile.phone` |
| B.2 | `profileCompletedAt` при createStaff CLIENT | Если есть реальное имя и `districtId` — вызвать `UserService.markProfileCompleted`. | 5.4 |
| B.3 | Поля компании в approve SUPPLIER | Контроллер читает `companyName` / `contactPerson` / `inn`. Тогда доработать модалку 8.2. | 8.2 |
| B.4 | Swagger approve без password | `admin.routes.js` — документация, не код панели. | — |

Prisma-миграций нет.

---

## Порядок выполнения

```
0.1 → 0.2 → 0.3          типы и имя
0.4 параллельно с 0.1
     ↓
1.1, 1.2 → 1.3, 1.4, 1.5 → 1.6
     ↓
2.1 → 2.2 → 2.3 → 2.4     каркас, можно проверить меню
     ↓
3.1 → 3.2 → 3.3 → 3.4     список (первый видимый результат)
     ↓
4.1 → 4.2 → 4.3           карточка read-only
     ↓
5.1 + 5.2 → 5.3 → 5.4     создание
     ↓
6.1 → 6.2; 6.3            смена роли и удаление (6.3 параллельно 6.2)
     ↓
7.1 → 7.2; 7.3            назначения
     ↓
8.1 → 8.2, 8.3 → 8.4      заявки
     ↓
9.1 → 9.2 → 9.3 → 9.4     приёмка
```

Фаза B — после 9.4 или параллельно, не в том же коммите, что UI.

Не прыгать к фазе 5, пока нет адаптеров (1.2) и списка (3.x): иначе создание нельзя проверить в реестре.

---

## Как вести учёт

Отмечать номер задачи (`3.2`, `6.3`) в коммите или в трекере. Одна фаза ≈ один логический PR; дробить можно по строкам таблицы, но не смешивать UI пользователей с правками сервера.

Связанные файлы:

- требования: `web/user-management-requirements.md`
- решения: `web/user-management-design.md`
- этот план: `web/user-management-tasks.md`
