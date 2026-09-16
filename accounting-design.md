# Технический дизайн: бухгалтерия в веб-панели

Версия: 1.0  
Связанный документ: `web/accounting-requirements.md` (v2.2)  
Стек панели: React 18 + TypeScript + Vite + Ant Design + TanStack Query + React Hook Form + Zod (FSD)  
Бэкенд: Express + Prisma + PostgreSQL + Redis (кэш summary)

---

## 0. Зафиксированные решения

Все строки из `accounting-requirements.md` §1.3 принимаются как есть. Ниже — только **как** это реализуется в коде. Смена строки §1.3 меняет указанный слой, не весь модуль.

| Тема | Как в коде |
|---|---|
| Last explicit cost | `InventoryService.addSupply` обновляет `warehousePrice` только если передан `warehousePrice`; receive передаёт `unitCost` или `undefined` |
| Снимок в продаже | `WarehouseSale.warehousePrice` уже пишется при продаже; добавить `isEstimatedCost`. Accounting DTO мапит это в `costAtSale` |
| Float → Decimal | Новые поля только `Decimal(12,2)`. Старые `Float` конвертировать на границе accounting через `decimal.js` / `Prisma.Decimal`, схему `WarehouseSale` в этом релизе не мигрировать |
| Минус запрещён | Все write идут в `InventoryService`; не писать `ProductStock` из accounting |
| Lock + order | `InventoryService.lockStocks(tx, keys)` сортирует `(warehouseId, productId)` ASC, `SELECT … FOR UPDATE`, затем conditional `updateMany` + `version` |
| Период | `AccountingPeriod` UNIQUE(year, month), без склада. Продажи не датируются задним числом |
| Idempotency | Middleware + таблица `IdempotencyRecord`, header обязателен на перечисленных POST |
| SUPPLY_RETURN | Значение enum есть, write-path отсутствует, тест что сервис его не вызывает |
| FINANCIER | `Admin.accountingProfile`, не новая `UserRole` |
| KPI UI | Stretch: API контракт в M6, страницы можно не делать в первом UI-срезе |
| Transfer UI | Схема + API complete в MVP; пункт меню — V2 |
| Деньги в JSON | number, округление до 2 знаков **после** Decimal-расчёта (совместимо с `formatPrice`) |
| Timezone | `ACCOUNTING_TIMEZONE=Europe/Moscow` в env, не хардкод в SQL |

---

## 1. Архитектура

Accounting — отдельный модуль. Операционные продажи по-прежнему создаёт только `WarehouseSaleService`. Остаток меняет только `InventoryService`.

```
web/  (тонкий клиент)
  RoleGate + accountingProfile
  pages/accounting/*  → features/accounting/*  → entities/accounting
        │
        ▼
  shared/api/client.ts   Authorization + refresh
  заголовок Idempotency-Key на write
        │
        ▼
server/src/routes/accounting.routes.js
  auth → requireAccounting(permission) → idempotency? → controller
        │
        ├─ services/accounting/*          чтение отчётов, документы
        ├─ services/inventory/inventory.service.js   единственный writer остатка
        ├─ services/warehouse/warehouseSale.service.js  единственный writer продаж
        └─ prisma
```

Правила:

- Accounting **не** вызывает `prisma.productStock.update` напрямую.
- `WarehouseSaleService.createSalesFromOrder|Stop|Direct` дополняется снимком `isEstimatedCost`, не переносится в accounting.
- Существующие `/api/warehouses/:id/statistics` не удаляются; кросс-складовый P&L живёт только в `/api/accounting/*`.
- Старая модель `Supply` не используется новыми операциями (deprecated, см. §3.12).

### 1.1 Дерево бэкенда

```
server/src/
  config/accounting.config.js
  middlewares/accountingAccess.middleware.js
  middlewares/idempotency.middleware.js
  utils/money.js                         Decimal helpers
  utils/accountingPeriod.js              timezone + month bounds
  utils/cacheKeys.js                     + keyAccountingSummary(...)
  routes/accounting.routes.js
  routes/index.js                        + /accounting
  validators/accounting.validator.js
  controllers/accounting/
    accounting.controller.js             summary, sales, comparison, movements,
                                         payments, control, export, product ledger
    supplies.controller.js
    inventory.controller.js
    transfers.controller.js              API only
    periods.controller.js
    audit.controller.js
  services/accounting/
    access.service.js                    profile + warehouse scope + DTO mask
    accounting-summary.service.js
    accounting-sales.service.js
    supply-document.service.js
    supply-reversal.service.js
    inventory-count.service.js
    transfer.service.js
    sales-adjustment.service.js
    period.service.js
    staff-kpi.service.js                 stretch
    driver-kpi.service.js                stretch
    accounting-control.service.js
    accounting-audit.service.js
    accounting-export.service.js
    accounting-alert.service.js
    audit-archive.job.js                 no-op пока AUDIT_ARCHIVE_ENABLED=false
  services/inventory/inventory.service.js  + lockStocks, version, alreadyLocked
  services/warehouse/warehouseSale.service.js  + isEstimatedCost
  prisma/schema.prisma
```

### 1.2 Дерево фронта

```
web/src/
  entities/accounting/
    api/accounting-api.ts
    api/supplies-api.ts
    api/inventory-api.ts
    model/types.ts
    model/permissions.ts                 canSeeCost(profile)
    index.ts
  features/accounting/
    model/query-keys.ts
    model/schemas.ts                     Zod
    model/period.ts                      presets → UTC ISO
    ui/PeriodFilter.tsx
    ui/Money.tsx                         formatPrice + hide if !canSeeCost
    ui/Idempotency.ts                    uuid на submit
    ui/SupplyReceiveForm.tsx
    ui/SupplyReversalModal.tsx
    ui/InventoryCompleteForm.tsx
    index.ts
  pages/accounting/
    ui/AccountingSummaryPage.tsx
    ui/AccountingSalesPage.tsx
    ui/AccountingSuppliesPage.tsx
    ui/AccountingSupplyDetailPage.tsx
    ui/AccountingWarehousesPage.tsx
    ui/AccountingMovementsPage.tsx
    ui/AccountingInventoryPage.tsx
    ui/AccountingInventoryDetailPage.tsx
    ui/AccountingControlPage.tsx
    ui/AccountingAuditPage.tsx
    ui/AccountingProductLedgerPage.tsx
    ui/AccountingStaffPage.tsx           stretch
    ui/AccountingDriversPage.tsx         stretch
    index.ts
  app/router/index.tsx
  widgets/layout/ui/MainLayout.tsx
  pages/dashboard/ui/DashboardPage.tsx   виджеты FULL/FINANCIER
```

Страницы не ходят в axios напрямую.

---

## 2. Доступ

### 2.1 Профиль

```prisma
enum AccountingProfile {
  OPERATOR
  FINANCIER
  FULL
}

model Admin {
  // существующие поля
  accountingProfile AccountingProfile @default(OPERATOR)
}
```

Вычисление (сервер, единственный источник):

```
if user.role === 'ADMIN' && user.admin.isSuperAdmin → FULL
else if user.role === 'ADMIN' → user.admin.accountingProfile  // OPERATOR | FINANCIER
else if user.role === 'EMPLOYEE' → OPERATOR
else → нет доступа
```

`isSuperAdmin` всегда побеждает профиль. При назначении суперадмина профиль можно синхронизировать в `FULL` (не обязательно для доступа).

EMPLOYEE не имеет записи `Admin`. Ему не нужен `accountingProfile`.

### 2.2 Permission middleware

```js
// requireAccounting('ACCOUNTING_SUPPLY_RECEIVE')
```

Таблица — как в requirements §4.1. Реализация: объект `PROFILE_PERMISSIONS[profile]` → `Set`. Нет таблицы Permission в БД.

После `auth`:

1. Посчитать profile.
2. Если permission нет → 403.
3. Положить `req.accounting = { profile, warehouseIds, canSeeCost, canSeeProfit }`.

### 2.3 Warehouse scope

```js
async function getAccessibleWarehouseIds(user) {
  if (user.role === 'ADMIN') return null; // все склады
  // EMPLOYEE: union(employee.warehouseId, employee.warehouses.id)
}
```

`null` = без фильтра. Не пустой массив.

Текущий `InventoryService.assertCanManageWarehouse` смотрит только `employee.warehouseId`. Для accounting и для приёмки **расширить** проверку на `warehouses[]`, иначе сотрудник с несколькими складами не проведёт документ на втором. Существующий productStock.controller начнёт пользоваться той же функцией — это намеренное выравнивание, не отдельный продукт.

### 2.4 Маскирование DTO

Никогда не отдавать клиенту поле, которого нет в permission. Функция `sanitizeAccountingDto(dto, { canSeeCost, canSeeProfit })` удаляет:

`warehousePrice`, `unitCost`, `costAtSale`, `cogs`, `profit`, `grossProfit`, `grossMargin`, `supplySpend`, `writeOffValue` (стоимостной), `estimated`, `actual`.

OPERATOR видит `revenue` (товарная выручка) по §4.1 `ACCOUNTING_REVENUE_VIEW=да`.

Вызывать sanitizer в контроллере перед `res.json`, не в React.

### 2.5 Маршруты панели

| Путь | Кто |
|---|---|
| `/accounting` | ADMIN (все профили) |
| `/accounting/sales` | ADMIN |
| `/accounting/warehouses` | ADMIN |
| `/accounting/control` | ADMIN с AUDIT/COST? Control видит FINANCIER и FULL; OPERATOR — операционные пункты без сумм себестоимости |
| `/accounting/audit` | FINANCIER, FULL |
| `/accounting/supplies*` | ADMIN + EMPLOYEE |
| `/accounting/inventory*` | ADMIN + EMPLOYEE |
| `/accounting/movements` | ADMIN + EMPLOYEE (EMPLOYEE — свои склады) |
| `/accounting/staff`, `/accounting/drivers` | ADMIN, stretch |
| `/accounting/products/:id` | ADMIN; вкладка на `/products/:id` тоже ок |

EMPLOYEE: в меню «Поставки» и «Инвентаризация», не пункт «Бухгалтерия» целиком. P&L не показываем.

`ProtectedRoute` не менять (уже пускает EMPLOYEE/ADMIN). Уточняет `RoleGate`.

---

## 3. Модель данных

Миграция одна логическая (`accounting_mvp`), можно разбить на 2–3 Prisma migrate, если объём большой. Имена ниже — канон для кода.

### 3.1 Product

```prisma
sku     String? @unique
barcode String? @unique

@@index([barcode])
```

Нормализация barcode до записи: trim, убрать пробелы, для EAN оставить цифры. Пустая строка → `null`.

### 3.2 ProductStock

```prisma
version Int @default(0)

@@index([warehouseId, productId]) // unique уже есть
```

CHECK `quantity >= 0`, `reserved >= 0` — включить в миграции **после** скрипта, который логирует аномалии. Если count аномалий > 0, constraint отложить, не валить migrate на проде.

### 3.3 WarehouseSale (точечно)

Не менять типы `Float`. Добавить:

```prisma
isEstimatedCost Boolean @default(false)
```

Accounting читает:

```
salePriceAtSale = sale.salePrice
costAtSale      = sale.warehousePrice
profitAtSale    = sale.profit
```

Backfill `isEstimatedCost`: для старых строк `false`, если так нельзя отличить — оставить `false` и не пересчитывать историю. Новые продажи ставят флаг по факту `productStock.warehousePrice == null` на момент снимка.

### 3.4 SalesAdjustment

```prisma
model SalesAdjustment {
  id            Int      @id @default(autoincrement())
  sourceSaleId  Int
  productId     Int
  warehouseId   Int
  quantity      Int      // коробки, всегда > 0
  amount        Decimal  @db.Decimal(12, 2) // выручка со знаком минус в отчёте
  cost          Decimal  @db.Decimal(12, 2)
  reason        String
  paymentId     Int?
  productReturnId Int?
  createdById   Int
  createdAt     DateTime @default(now())
  sourceSale    WarehouseSale @relation(...)
  @@index([sourceSaleId])
  @@index([createdAt])
  @@index([warehouseId, createdAt])
}
```

Сумма `quantity` adjustments по одной продаже ≤ `WarehouseSale.quantity`.

Net sales:

```
gross = SUM(salePrice * qty)
returns = SUM(adjustment.amount)  // хранить положительную величину возврата
net = gross - returns
```

В `amount` хранить **положительную** сумму возвращённой выручки (`qty * salePriceAtSale`), в отчёте вычитать.

### 3.5 SupplyDocument

```prisma
enum SupplyDocumentStatus {
  DRAFT
  RECEIVED
  CANCELLED
  REVERSED
  PARTIALLY_REVERSED
}

model SupplyDocument {
  id            Int      @id @default(autoincrement())
  number        String
  supplierId    Int
  warehouseId   Int
  status        SupplyDocumentStatus @default(DRAFT)
  documentDate  DateTime
  receivedAt    DateTime?
  receivedById  Int?
  reversedAt    DateTime?
  reversedById  Int?
  cancelledAt   DateTime?
  cancelledById Int?
  comment       String?
  totalAmount   Decimal  @default(0) @db.Decimal(12, 2)
  isLateEntry   Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lines         SupplyDocumentLine[]
  reversals     SupplyReversal[]
  @@unique([supplierId, number])
  @@index([warehouseId, status])
  @@index([documentDate])
}

model SupplyDocumentLine {
  id             Int      @id @default(autoincrement())
  documentId     Int
  productId      Int
  quantity       Int
  unitCost       Decimal? @db.Decimal(12, 2)
  barcodeScanned String?
  reversedQty    Int      @default(0)
  @@index([documentId])
  @@index([productId])
}

model SupplyReversal {
  id             Int      @id @default(autoincrement())
  documentId     Int
  lineId         Int
  quantity       Int
  createdById    Int
  reason         String
  isLateEntry    Boolean  @default(false)
  createdAt      DateTime @default(now())
  @@index([documentId])
  @@index([lineId])
}
```

`totalAmount` = SUM(qty * coalesce(unitCost, 0)) при сохранении строк. Для spend в P&L: SUM только строк с непустым `unitCost` после RECEIVED (спека: spend из полученных линий). Строки без цены в spend не входят, в Control — «поставки без unitCost».

Статусы: если сторно частичное → `PARTIALLY_REVERSED`; полное по всем строкам → `REVERSED`. Документ не удаляется.

### 3.6 InventoryCount

```prisma
enum InventoryCountStatus { DRAFT COMPLETED CANCELLED }

model InventoryCount {
  id           Int      @id @default(autoincrement())
  warehouseId  Int
  status       InventoryCountStatus @default(DRAFT)
  documentDate DateTime
  completedAt  DateTime?
  completedById Int?
  comment      String?
  isLateEntry  Boolean  @default(false)
  createdById  Int
  createdAt    DateTime @default(now())
  lines        InventoryCountLine[]
}

model InventoryCountLine {
  id               Int @id @default(autoincrement())
  inventoryCountId Int
  productId        Int
  expectedQuantity Int
  actualQuantity   Int
  reason           String?
}
```

При complete `expectedQuantity` берётся с залоченного остатка в транзакции, не из черновика, если черновик устарел: если `expected` в строке ≠ текущий quantity → 409 `STOCK_CHANGED`, клиент обновляет черновик.

### 3.7 Transfer (контракт MVP, UI V2)

```prisma
enum TransferStatus { DRAFT COMPLETED CANCELLED }

model StockTransfer {
  id              Int @id @default(autoincrement())
  fromWarehouseId Int
  toWarehouseId   Int
  status          TransferStatus @default(DRAFT)
  documentDate    DateTime
  completedAt     DateTime?
  completedById   Int?
  isLateEntry     Boolean @default(false)
  comment         String?
  lines           StockTransferLine[]
}

model StockTransferLine {
  id         Int @id @default(autoincrement())
  transferId Int
  productId  Int
  quantity   Int
}
```

Complete: lock `(from, sku)` и `(to, sku)` в порядке warehouseId, productId; `TRANSFER_OUT` / `TRANSFER_IN`; `warehousePrice` получателя не менять (остаётся last explicit на целевом складе). Перемещение не меняет выручку.

### 3.8 AccountingPeriod, Idempotency, AuditLog

Как в requirements §13 / §17.1 / §28.3.

```prisma
model AccountingPeriod { ... @@unique([year, month]) }

model IdempotencyRecord {
  id           Int      @id @default(autoincrement())
  key          String   @unique
  userId       Int
  endpoint     String
  requestHash  String
  statusCode   Int
  responseBody Json
  createdAt    DateTime @default(now())
  @@index([createdAt])
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String
  entityType String
  entityId   Int?
  before     Json?
  after      Json?
  reason     String?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
  @@index([userId, createdAt])
  @@index([createdAt])
}
```

### 3.9 Enums StockHistory

```prisma
enum StockOperation {
  SELL
  SUPPLY
  ADJUSTMENT
  RETURN
  WRITE_OFF
  TRANSFER_OUT
  TRANSFER_IN
  SUPPLY_REVERSAL
  SUPPLY_RETURN   // write запрещён в коде MVP
  PRICE_CHANGE    // qty=0, data: { old, new }
}

enum SourceType {
  CART
  ORDER
  SUPPLY
  MANUAL
  SYSTEM
  RETURN
  INVENTORY_COUNT
  TRANSFER
  SUPPLY_REVERSAL
  ACCOUNTING
}
```

`writeHistory` с `SUPPLY_RETURN` в MVP бросает `Error` (assert), чтобы случайный вызов не прошёл.

### 3.10 PRICE_CHANGE

Отдельный endpoint `PUT /api/accounting/stocks/price` (FULL). Не документ поставки. Пишет AuditLog + StockHistory PRICE_CHANGE. Меняет только `ProductStock.warehousePrice`.

### 3.11 Связи Prisma

Добавить обратные поля: `Warehouse.supplyDocuments`, `Supplier.supplyDocuments`, `WarehouseSale.adjustments`, `User` для audit/idempotency по желанию без жёсткого onDelete Cascade на финансах (`SetNull` для userId в AuditLog).

### 3.12 Старая Supply

Перед migrate: `COUNT(*)`. Новые операции не пишут в `Supply`. Удаление таблицы — отдельный релиз после проверки `product.controller` `prisma.supply.count`.

---

## 4. InventoryService

Единственное место мутации остатка. Расширения:

### 4.1 `lockStocks(tx, keys[])`

```
keys: { warehouseId, productId }[]
unique by pair
sort warehouseId ASC, productId ASC
for each key:
  SELECT id FROM ProductStock WHERE productId=$p AND warehouseId=$w FOR UPDATE
  if missing: INSERT quantity=0 reserved=0 version=0; SELECT FOR UPDATE again
return Map<`${w}:${p}`, row>
```

Использовать `tx.$queryRaw` с параметрами (без интерполяции строк). Имена таблиц — как в Postgres (`"ProductStock"`), сверить `@@map` (сейчас map нет, Prisma default `"ProductStock"`).

### 4.2 Флаг `alreadyLocked`

`addSupply`, `decrementAvailable`, `setQuantity` принимают `{ alreadyLocked: true }`. Тогда не делают свой SELECT, работают по переданной/перечитанной строке, но **conditional updateMany** с `version` оставляют.

Пакетный receive:

```
await prisma.$transaction(async tx => {
  await lockStocks(tx, lines.map(...));
  for (const line of linesSorted) {
    await addSupply(tx, { ..., warehousePrice: line.unitCost ?? undefined, alreadyLocked: true });
  }
});
```

Пустой `unitCost` → в addSupply **не передавать** `warehousePrice` (не `null`).

### 4.3 version

Каждый успешный update: `version: { increment: 1 }` и в WHERE `version: expectedVersion`. Несовпадение → 409.

### 4.4 Deadlock

Поймать Prisma `P2034` / PG `40P01` → проброс 409 `DEADLOCK_RETRY`. Клиент с тем же Idempotency-Key повторяет. Не крутить бесконечный retry в том же запросе больше 1 раза (один внутренний retry допустим в сервисе).

---

## 5. Снимок продажи

В `WarehouseSaleService` при создании строки:

```
explicit = productStock?.warehousePrice   // Decimal | null
cost = explicit != null
  ? Number(explicit)
  : PriceCalculationService.getEffectiveWarehousePrice(...)
isEstimatedCost = explicit == null
warehousePrice = cost   // существующее поле-снимок
profit = (salePrice - cost) * quantity
```

Не читать цену заново в accounting-summary: только поля продажи + adjustments.

Прямая продажа и STOP — тот же снимок.

Если `decrementAvailable` отказал, продажа не создаётся (уже так на складском пути заказа). Не создавать `WarehouseSale` «в минус».

---

## 6. Деньги и период

### 6.1 `utils/money.js`

```
toDecimal(x) → Decimal
money(x) → Decimal quantized 2 dp ROUND_HALF_UP
toNumber(d) → Number(d.toFixed(2))   // только на выходе API
sum(arr)
```

Запрещено `+` на деньгах в accounting services. Коробки остаются `Int`.

### 6.2 Период

`utils/accountingPeriod.js`:

- env `ACCOUNTING_TIMEZONE` default `Europe/Moscow`;
- пресет `month` = календарный месяц компании, не «30 дней»;
- вход API: `startDate`, `endDate` ISO UTC **или** `period=month&date=2026-03-01`;
- границы: `[startInclusive, endExclusive)` в UTC, посчитанные из tz, чтобы 31.03 23:59 MSK не утекал в апрель.

Проверка writable:

```
year/month документа в tz компании
найти AccountingPeriod; нет строки → OPEN
CLOSED && !confirmLateEntry → 403 PERIOD_CLOSED
CLOSED && confirmLateEntry && FULL → ok, isLateEntry=true
documentDate > end of today in tz → 400 DOCUMENT_DATE_IN_FUTURE
```

Продажи (`soldAt=now`) эту проверку не вызывают.

Endpoint:

```
GET  /api/accounting/periods
POST /api/accounting/periods/:year/:month/close
POST /api/accounting/periods/:year/:month/reopen   body: { reason }
```

---

## 7. Идемпотентность

Middleware на:

- `POST .../supplies/:id/receive`
- `POST .../supplies/:id/reverse`
- `POST .../supplies/:id/cancel`
- `POST .../inventory/:id/complete`
- `POST .../transfers/:id/complete`

Header `Idempotency-Key` UUID v4 обязателен. Нет ключа → 400.

`requestHash` = sha256(userId + method + path + stableJSON(body)).

TTL 24ч. Чистка: тот же no-op cron, можно включить `DELETE WHERE createdAt < now-24h` сразу (это не archive AuditLog, безопасно в MVP).

Повтор с тем же ключом и hash: вернуть сохранённый status + body, **не** заходить в сервис. Повтор с другим hash: 409 `IDEMPOTENCY_KEY_REUSED`.

Запись записи **после** успешного (и после 4xx бизнес-отказа, чтобы повтор отдал тот же 409 статуса документа). 5xx не кэшировать.

---

## 8. API

База: `/api/accounting`.  
Общее: `auth` + роль ADMIN|EMPLOYEE + `requireAccounting`.  
Формат ответа как в проекте: `{ status, data, message? }`.

### 8.1 Read

```
GET /summary
GET /sales                  page, limit, фильтры периода/склада/типа/товара/поставщика
GET /warehouses/comparison
GET /stock-history
GET /payments/summary
GET /control
GET /audit                  FINANCIER+FULL
GET /products/:id/ledger
GET /staff-kpi              stretch
GET /drivers-kpi            stretch
GET /export?format=csv|xlsx
```

`GET /warehouses/comparison` внутри вызывает `WarehouseStatisticsService.getComparisonStatistics` + остатки; cost-поля режет sanitizer.

Пагинация: `page`, `limit` default 20 max 100. Итоги реестра продаж (`totals`) в том же ответе, что и rows, тем же фильтром без page (агрегат SQL, не сумма текущей страницы).

### 8.2 Supplies

```
GET    /supplies
POST   /supplies
GET    /supplies/:id
PATCH  /supplies/:id          только DRAFT
POST   /supplies/:id/receive
POST   /supplies/:id/cancel
POST   /supplies/:id/reverse  body: { lines: [{ lineId, quantity }], reason, confirmLateEntry? }
```

Receive: статус должен быть DRAFT; 409 если уже RECEIVED.

Reverse: FULL; qty ≤ remaining и ≤ available.

Строки поставки: товар принадлежит `supplierId` документа, иначе 400. FULL может обойти только если явно `allowForeignProducts` **не** делаем в MVP (requirements: нет).

### 8.3 Inventory / transfer / price

```
GET/POST /inventory
GET      /inventory/:id
POST     /inventory/:id/complete

POST /transfers
GET  /transfers
GET  /transfers/:id
POST /transfers/:id/complete     FULL

PUT  /stocks/price               FULL  { warehouseId, productId, warehousePrice, reason }
```

### 8.4 Коды ошибок

Стабильные `code` в ApiError:

`PERIOD_CLOSED`, `DOCUMENT_DATE_IN_FUTURE`, `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_REQUIRED`, `INSUFFICIENT_STOCK`, `STOCK_CHANGED`, `SUPPLY_NOT_DRAFT`, `ALREADY_RECEIVED`, `REVERSE_EXCEEDS_AVAILABLE`, `REVERSE_EXCEEDS_LINE`, `DEADLOCK_RETRY`, `COST_FORBIDDEN`.

---

## 9. Сервисы отчётов

### 9.1 Summary

Один SQL-friendly набор запросов в `Promise.all`:

- продажи: SUM/COUNT `WarehouseSale` по `soldAt`;
- adjustments за период по `createdAt`;
- deliveryFee заказов `DELIVERED` и `updatedAt`/`statusHistory` — **взять дату перехода в DELIVERED** из `OrderStatusHistory` если есть, иначе `updatedAt` (зафиксировать в коде комментарием; предпочтение history);
- payments по `completedAt` / `refundedAt`;
- supplies RECEIVED по `receivedAt` (не documentDate) для spend — spend отражает факт оприходования;
- rewards PAID по `processedAt`;
- write-off: StockHistory WRITE_OFF × cost — cost брать `ProductStock.warehousePrice` текущий только как fallback; лучше писать cost в `StockHistory.data` при списании.

Кэш Redis: `accounting:summary:${profile}:${scopeHash}:${queryHash}` TTL 45s. Write-документы вызывают `del` по префиксу `accounting:summary:` (уже есть `clearCache` pattern). Продажи с заказа не обязаны мгновенно сбрасывать кэш — допустима задержка TTL.

### 9.2 Control

Отдельные COUNT-запросы, не полный dump. Пороги из `accounting.config.js`:

```
ALERT_ADJUSTMENT_QTY=50
ALERT_DRAFT_DAYS=3
```

Отрицательные остатки: `WHERE quantity < 0 OR quantity < reserved` — аномалия.

### 9.3 Export

CSV: без новой зависимости (`string` + BOM UTF-8).  
XLSX: добавить `exceljs` в `server/package.json` (в репозитории xlsx сейчас нет). Листы как в spec §27.

Каждый вызов: AuditLog `ACCOUNTING_EXPORT`. Rate limit: 10 / 10 мин на userId (память процесса или Redis). OPERATOR — колонки без cost.

### 9.4 Alerts

`accounting-alert.service.js` после критического write: `prisma.notification.create` (модель уже есть) на всех `Admin.isSuperAdmin`. Email/Telegram не в MVP. Не дублировать, если такой notification за 10 минут уже есть (как stagnant cron).

---

## 10. Проведение поставки (поток)

1. Idempotency middleware.
2. Permission RECEIVE, warehouse in scope.
3. Transaction:
   - load document FOR UPDATE (строка документа, `SELECT … FOR UPDATE` по `SupplyDocument.id`);
   - status DRAFT иначе 409;
   - period check;
   - `lockStocks` по всем line keys;
   - для каждой линии `addSupply` alreadyLocked, price = unitCost или omit;
   - recalc `totalAmount`;
   - status RECEIVED, receivedAt/By, isLateEntry;
   - AuditLog.
4. Invalidate cache, optional alert если spend > порога.

Сторно: lock stocks; для каждой reverse-line `decrementAvailable` operation `SUPPLY_REVERSAL`; increment `reversedQty`; status PARTIALLY_REVERSED/REVERSED.

---

## 11. Фронт

### 11.1 Период

`PeriodFilter`: сегменты день/неделя/месяц/год + RangePicker. В API уходит UTC ISO из `ACCOUNTING_TIMEZONE` (прочитать с summary.period.timezone или зашить `Europe/Moscow` в `shared/config` пока нет company settings).

Query-keys: `['accounting','summary', filters]`. После receive — invalidate `accounting`.

### 11.2 Idempotency на клиенте

На каждый submit `crypto.randomUUID()`, хранить в ref до успеха. Retry кнопки «Повторить» **переиспользует** тот же UUID. Новый клик «Провести» после успеха — новый UUID.

Прокинуть header в `apiClient` через `config.headers['Idempotency-Key']` только на этих методах, не глобально.

### 11.3 Деньги

`formatPrice`. Поля cost рендерить только если `canSeeCost` из профиля (`getProfile` → `admin.isSuperAdmin` или `accountingProfile === 'FINANCIER' |` super). Поле профиля добавить в `entities/user` types.

Не полагаться на отсутствие поля в JSON как на единственную защиту — сервер всё равно режет.

### 11.4 Меню

ADMIN: «Бухгалтерия» → `/accounting`.  
EMPLOYEE: «Поставки», «Инвентаризация».  
Badge: count DRAFT поставок для FULL (опционально, как заявки).

Дашборд `/`: для FULL/FINANCIER 4 statistic + ссылка, один запрос `GET /summary?period=month`.

### 11.5 HID в MVP

На деталке поставки поле «Штрихкод» с onPress Enter: найти product `GET /api/accounting/products/by-barcode?code=` (маленький endpoint) → +1 к qty строки или новая строка. Камера не делается. Unknown → модалка «не найден».

Это не полный V2 scanner; минимальная закладка spec FR-31 без отдельного спринта камеры.

---

## 12. Конфиг и env

```
ACCOUNTING_TIMEZONE=Europe/Moscow
ACCOUNTING_SUMMARY_CACHE_TTL=45
AUDIT_RETENTION_MONTHS=24
AUDIT_ARCHIVE_ENABLED=false
ACCOUNTING_ALERT_ADJUSTMENT_QTY=50
ACCOUNTING_ALERT_DRAFT_DAYS=3
ACCOUNTING_EXPORT_RATE_MAX=10
ACCOUNTING_EXPORT_RATE_WINDOW_SEC=600
```

`config/accounting.config.js` по образцу `chat.config.js`.

Cron archive: регистрация рядом со stagnant (найти bootstrap `app.js` / `server.js`, где уже дергается cron). Job: если флаг false — log skip; плюс purge IdempotencyRecord > 24h.

---

## 13. Тесты

Jest уже есть на сервере.

Обязательные integration (requirements §32.2 + AC-13…21):

- last explicit cost 80 затем 100;
- unitCost empty не null'ит цену;
- reverse > available → отказ;
- parallel receive same key;
- ordered lock: mock два transfer (можно unit на `lockStocks` sort + integration если есть test DB);
- OPERATOR DTO без cost;
- FINANCIER GET summary с profit, POST receive 403;
- period closed;
- SUPPLY_RETURN не вызывается (grep/unit assert на writeHistory).

Не поднимать полный UI e2e в MVP.

---

## 14. Порядок внедрения (карта на код)

Совпадает с requirements M1–M9:

| Milestone | Backend | Web |
|---|---|---|
| M1 | schema, money, lockStocks, version, access, isEstimatedCost на продаже | types профиля |
| M2 | read API summary/sales/comparison/movements/payments/control/audit | — |
| M3 | — | summary, sales, warehouses, dashboard widgets, меню |
| M4 | supplies + reversal + idempotency | supplies UI + HID field |
| M5 | inventory, period, alerts, PRICE_CHANGE | inventory, control, audit |
| M6 stretch | staff/drivers kpi | optional pages |
| M7 | export csv/xlsx + rate limit | кнопки экспорта |
| M8 | barcode lookup уже с M4 | камера не входит |
| M9 | tests, archive no-op checklist | — |
| Transfer API | можно в M5 без меню | V2 UI |

Блокирующий для старта: M1 lock ordering. Без него не мержить receive/transfer.

---

## 15. Что сознательно не делаем в этом дизайне

- Партионный FIFO / средневзвешенная формула записи цены.
- Пересчёт исторических `WarehouseSale.profit`.
- Миграция Float → Decimal на `WarehouseSale`.
- Таблица ACL permission.
- Касса фургона.
- Worker-очередь (Bull) для архива.
- Закрытие периода по складу.
- Сервис `SUPPLY_RETURN`.
- Обход `InventoryService`.

---

## 16. Принцип проверки PR

Перед merge любого accounting PR:

1. Нет `prisma.productStock.update` вне `InventoryService`.
2. Нет `writeHistory(..., 'SUPPLY_RETURN')`.
3. Пакетный lock идёт через `lockStocks`.
4. Деньги через `utils/money`.
5. DTO после sanitizer.
6. Write из списка §7 с Idempotency-Key.
7. Тест на затронутый инвариант из AC.
