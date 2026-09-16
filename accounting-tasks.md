# План задач: бухгалтерия в веб-панели

План выполнения `web/accounting-requirements.md` (v2.2) по решениям из `web/accounting-design.md` (v1.0).

Существующие `web/tasks.md` (портал поставщика) и `web/user-management-tasks.md` не расширяем. Этот файл — отдельный трек.

**Архитектура.** Backend: новый модуль `server/src/services/accounting/*` + точечные правки `InventoryService` и `WarehouseSaleService`. Frontend: FSD, импорты только вниз, страницы не вызывают axios.

**Жёсткие запреты (не класть в задачи ниже):**

- `prisma.productStock.update` вне `InventoryService`;
- write `StockHistory.operation = SUPPLY_RETURN`;
- ручное создание `WarehouseSale` из accounting;
- миграция `Float` → `Decimal` на существующих полях `WarehouseSale`;
- FIFO / weighted average;
- касса фургона, камера-сканер, UI перемещений, таблица Permission;
- закрытие периода по складу.

**Каждый PR:** чеклист design §16. Backend: тесты на затронутый AC. Frontend: `npm run build` в `web/` зелёный.

Порядок фаз = design §14 (M1→M9). **Не начинать M4 receive, пока не смержен `lockStocks` (фаза 1).**

---

## Фаза 0: Схема, конфиг, деньги

Без HTTP. Нужна, чтобы сервисы не считали деньги через `+` и не писали в несуществующие таблицы.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 0.1 | Инвентаризация старой `Supply` | `SELECT COUNT(*) FROM "Supply"` + grep `prisma.supply` (есть в `product.controller`). Зафиксировать в комментарии миграции: новая модель `SupplyDocument`, старую не пишем. Не drop. | — |
| 0.2 | Prisma: enums и Product/Stock | `sku`/`barcode` unique на `Product`; `ProductStock.version Int @default(0)`; расширить `StockOperation` и `SourceType` по design §3.9. `SUPPLY_RETURN` в enum **есть**. | 0.1 |
| 0.3 | Prisma: документы | Модели `SupplyDocument`, `SupplyDocumentLine`, `SupplyReversal`, `InventoryCount`+Line, `StockTransfer`+Line, `SalesAdjustment`, `AccountingPeriod`, `IdempotencyRecord`, `AuditLog`. `WarehouseSale.isEstimatedCost`. `Admin.accountingProfile`. Связи, индексы, `@@unique([supplierId, number])`, `@@unique([year, month])`. Деньги новых полей — `Decimal(12,2)`. | 0.2 |
| 0.4 | Миграция | `npm run prisma:migrate` в `server/`. Скрипт-лог аномалий `quantity < 0` до CHECK; CHECK на остаток — только если аномалий 0 (design §3.2). Backfill `isEstimatedCost=false`. | 0.3 |
| 0.5 | Конфиг | `server/src/config/accounting.config.js` + env из design §12. `.env.example` на сервере. Timezone default `Europe/Moscow`. | — |
| 0.6 | `utils/money.js` | `toDecimal`, `money` (2 dp HALF_UP), `toNumber` только на выходе API, `sum`. Без `+` на деньгах. Unit-тесты округления. | — |
| 0.7 | `utils/accountingPeriod.js` | Пресеты календарный месяц/день/неделя/год в tz компании → `[startInclusive, endExclusive)` UTC. Запрет будущей `documentDate`. Хелпер «year/month документа». Unit-тесты границы 31.03 21:00 UTC ↔ апрель MSK. | 0.5 |

Критерий фазы: generate клиент Prisma проходит, money/period тесты зелёные, приложение стартует.

---

## Фаза 1: Остаток и снимок продажи (блокер)

Пока это не в main, **не мержить** receive/reverse/transfer/inventory complete.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 1.1 | `lockStocks(tx, keys)` | В `InventoryService`: unique keys, sort `(warehouseId, productId)` ASC, `SELECT … FOR UPDATE` через `$queryRaw` с параметрами, create+lock если нет строки. Имя таблицы сверить с Prisma (`"ProductStock"`). | 0.2, 0.4 |
| 1.2 | `alreadyLocked` + `version` | `addSupply` / `decrementAvailable` / `setQuantity`: WHERE `version`, increment; пустой `warehousePrice` **не передавать** (не писать `null`). Пакетный caller: lock все ключи → цикл alreadyLocked. 409 `STOCK_CHANGED` / `INSUFFICIENT_STOCK`. | 1.1 |
| 1.3 | Deadlock | Поймать `P2034` / `40P01` → 409 `DEADLOCK_RETRY`. Один внутренний retry допустим. | 1.2 |
| 1.4 | Scope складов сотрудника | Общая `getAccessibleWarehouseIds`: union `warehouseId` + `warehouses[]`. `assertCanManageWarehouse` перевести на неё (accounting + существующий productStock). ADMIN → все склады. | — |
| 1.5 | Снимок продажи | В `WarehouseSaleService` трёх create*: `isEstimatedCost = (explicit warehousePrice == null)`; cost как сейчас через `PriceCalculationService`. Не пересчитывать старые `profit`. | 0.3 |
| 1.6 | Запрет SUPPLY_RETURN | `writeHistory`: если operation `SUPPLY_RETURN` → throw. Unit-тест. | 0.2 |
| 1.7 | Тесты фазы 1 | AC-13/14 на addSupply (80 затем 100; пустой unitCost не затирает); decrement не уходит в минус; `lockStocks` порядок ключей (unit на sort). | 1.1–1.6 |

AC: AC-8, AC-13, AC-14, AC-16, AC-21 (часть: порядок ключей).

---

## Фаза 2: Доступ, аудит, идемпотентность, периоды

Каркас HTTP без бизнес-отчётов.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 2.1 | `access.service.js` | Profile: super → FULL, ADMIN → `accountingProfile`, EMPLOYEE → OPERATOR. Набор permission по design §2.1 / requirements §4.1. `sanitizeAccountingDto`. | 0.3 |
| 2.2 | Middleware | `requireAccounting(permission)`; кладёт `req.accounting`. Роли маршрута: ADMIN+EMPLOYEE. 403 без права. | 2.1 |
| 2.3 | `AuditLog` writer | `accounting-audit.service.js`: не класть секреты в before/after. | 0.3 |
| 2.4 | Idempotency | Таблица + `idempotency.middleware.js`. Header UUID обязателен на списке design §7. Нет ключа → 400; тот же key+hash → сохранённый ответ; другой body → 409. 5xx не кэшировать. Purge >24h в job фазы 10. | 0.3 |
| 2.5 | Периоды | `period.service.js`: нет строки = OPEN; CLOSED без late entry → 403; FULL + `confirmLateEntry` → `isLateEntry`. Endpoint GET/close/reopen. Audit + алерт на close/reopen (алерт можно заглушкой до 6.5). | 0.7, 2.1–2.3 |
| 2.6 | Роутер-заглушка | `accounting.routes.js` + `router.use('/accounting')` в `index.js`. Пока `/summary` 501 или пустой handler — лишь бы модуль монтировался. | 2.2 |
| 2.7 | Типы профиля на вебе | `entities/user`: `AccountingProfile`, поле `admin.accountingProfile`. `canSeeCost` в `entities/accounting/model/permissions.ts` (слайс-заготовка). | — |

AC: AC-4 (каркас sanitizer), AC-10 (audit writer), AC-18 (period service).

---

## Фаза 3: Read API (без документов)

Веб ещё не обязателен. Проверка через HTTP + роль OPERATOR vs FULL.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 3.1 | Summary | `GET /api/accounting/summary`. Формулы requirements §6, deliveryFee по `OrderStatusHistory` в DELIVERED (design §9.1). Кэш Redis 45s, ключ с profile+scope+query. Sanitizer. | 0.6, 2.1, 2.6 |
| 3.2 | Реестр продаж | `GET /sales`: пагинация, фильтры, **totals тем же фильтром** (не сумма страницы). JOIN adjustments. Маппинг `costAtSale` ← `warehousePrice`. | 3.1 |
| 3.3 | Comparison + movements | Comparison: обёртка `getComparisonStatistics` + остатки, cost режет sanitizer. `GET /stock-history` с sourceType/sourceId. | 3.1 |
| 3.4 | Payments + control + audit read | `GET /payments/summary`; `GET /control` (COUNT аномалий, в т.ч. минус как баг); `GET /audit` только FINANCIER+FULL. | 3.1, 2.3 |
| 3.5 | Product ledger | `GET /products/:id/ledger`: продажи, приходы SupplyDocument, movements, остатки по складам. | 3.2, 3.3 |
| 3.6 | Тесты read | Одинаковый фильтр summary vs sales totals (AC-11); OPERATOR без cost (AC-4); FINANCIER видит profit. | 3.1–3.4 |

AC: AC-1 (чтение уже существующих продаж), AC-4, AC-9, AC-11, AC-12.

---

## Фаза 4: Веб — сводка, продажи, склады

Можно параллельно с фазой 5, но меню уже ведёт на живые read.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 4.1 | Entity + feature каркас | `entities/accounting` types/api; `features/accounting`: query-keys, PeriodFilter (пресеты → UTC ISO), Money, schemas. Публичный `index.ts`. | 2.7, 3.1 |
| 4.2 | Заглушки страниц + роуты | Страницы из design §1.2. Роуты в `app/router`: ADMIN — `/accounting` и дочерние; EMPLOYEE — только supplies/inventory (пока заглушки). `RoleGate`. `ProtectedRoute` не менять. | 4.1 |
| 4.3 | Меню | ADMIN: «Бухгалтерия». EMPLOYEE: «Поставки», «Инвентаризация». Не показывать P&L сотруднику. | 4.2 |
| 4.4 | Summary page | Карточки FR-1…FR-7. Cost/profit только `canSeeCost`. График по дням — лёгкий recharts или antd charts; если тяжёло — таблица по дням, график не блокер. | 4.2, 3.1 |
| 4.5 | Sales + warehouses pages | Таблица продаж с фильтрами PeriodFilter; клик ORDER → `orderNumber`. Comparison складов. Пустые состояния / ошибки `getApiMessage`. `scroll.x` на мобиле. | 4.4, 3.2, 3.3 |
| 4.6 | Виджеты дашборда | На `/` для FULL/FINANCIER: 3–4 Statistic + ссылка «Открыть бухгалтерию». Один `GET /summary?period=month`. Кабинет поставщика не трогать. | 4.4 |
| 4.7 | Control (чтение) | Страница `/accounting/control` из GET /control. OPERATOR без стоимостных аномалий. | 3.4, 4.2 |

AC: FR-1…FR-7, FR-10…FR-14, FR-40…FR-42, FR-80, FR-81.

---

## Фаза 5: Поставки (ядро доверия к цифрам)

Не стартовать без фазы 1.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 5.1 | CRUD DRAFT | POST/PATCH/GET supplies. Номер unique на поставщика. Строки: товар `supplierId` документа, иначе 400. `totalAmount` пересчёт. CANCEL DRAFT не трогает сток. | 0.3, 2.2, 2.5 |
| 5.2 | Receive | Транзакция: FOR UPDATE документа, period, `lockStocks`, addSupply alreadyLocked, last explicit cost, RECEIVED, AuditLog, cache bust. Повтор статуса → 409. Idempotency. | 5.1, 1.2, 2.4 |
| 5.3 | Reverse | FULL. qty ≤ remaining линии и ≤ available (не партии). StockHistory `SUPPLY_REVERSAL`. PARTIALLY_REVERSED / REVERSED. Не удалять документ. | 5.2 |
| 5.4 | Lookup barcode | `GET /products/by-barcode`. Не создаёт товар. 404 → UI «не найден». | 0.2 |
| 5.5 | UI поставок | Список, карточка, форма DRAFT, кнопка Провести (Idempotency-Key в ref, retry тот же UUID). HID-поле + Enter → barcode lookup, qty+1. Модалка сторно для FULL. EMPLOYEE — свой склад. | 5.1–5.4, 4.2 |
| 5.6 | Тесты поставок | AC-2, AC-3, AC-5, AC-15, AC-17; пустой unitCost; parallel same key; documentDate завтра 400. | 5.2, 5.3 |

AC: AC-2, AC-3, AC-5, AC-7 (ещё не инвентаризация), AC-14, AC-15, AC-17, FR-20…FR-26, FR-30…FR-33 (HID без камеры).

---

## Фаза 6: Инвентаризация, цена, алерты, adjustments

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 6.1 | InventoryCount | DRAFT/complete/cancel. Complete: lock строк; если expected ≠ текущий quantity → 409 `STOCK_CHANGED`. ADJUSTMENT через InventoryService, source INVENTORY_COUNT. actual < reserved → отказ. EMPLOYEE в scope по умолчанию (§4.2 spec). | 1.2, 2.5 |
| 6.2 | UI инвентаризации | Список + проведение. Reason на большом минусе. | 6.1, 4.2 |
| 6.3 | PRICE_CHANGE | `PUT /stocks/price` FULL. History qty=0, AuditLog. Не трогает costAtSale продаж. | 1.2, 2.3 |
| 6.4 | SalesAdjustment | Сервис: возврат продажи, qty ≤ sold−already returned; amount положительный. **Не** создавать Payment refund. Опциональный `productReturnId`. Хук из `completeReturn` — только если связь с продажей однозначна; иначе accounting агрегирует ProductReturn отдельно, без автосвязки 1:1 (spec §5.8). | 0.3 |
| 6.5 | Алерты | После крупного adjust, минуса, late entry, DRAFT>N дней (cron): `Notification` суперадминам, дедуп 10 мин как stagnant. | 0.5, 2.3 |
| 6.6 | Audit UI | `/accounting/audit` для FINANCIER+FULL. | 3.4, 4.2 |
| 6.7 | Тесты | AC-7, AC-8 (цена после продажи), AC-19 (return ≠ refund). | 6.1, 6.3, 6.4 |

AC: AC-7, AC-8, AC-10, AC-18, AC-19, FR-70…FR-73.

---

## Фаза 7: Перемещения (API без меню)

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 7.1 | StockTransfer API | CRUD DRAFT + complete FULL. Lock from+to в порядке warehouseId, productId. TRANSFER_OUT/IN. Не менять warehousePrice получателя. Не влияет на выручку. Idempotency на complete. | 1.1, 2.4 |
| 7.2 | Тест AC-21 | Два встречных complete (или unit на порядок lock + один integration). Меню на вебе **не** добавлять. | 7.1 |

AC: AC-21. UI — V2, в этот план не входит.

---

## Фаза 8: KPI (stretch, можно после 10)

Не блокирует P&L. Не делать вместо фаз 5–6.

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 8.1 | `GET /staff-kpi` | assignedToId, статусы, rewards; если KPI по текущему району — поле `retrospective: false` в ответе. | 3.1 |
| 8.2 | `GET /drivers-kpi` | Стопы + STOP sales. Profit режет sanitizer. | 3.1 |
| 8.3 | UI (опционально) | `/accounting/staff`, `/accounting/drivers`. Можно отложить целиком. | 8.1, 8.2, 4.2 |

AC: FR-50…FR-62 (если фаза взята).

---

## Фаза 9: Экспорт и сверка

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 9.1 | CSV | Без новой зависимости, BOM UTF-8. Те же фильтры и sanitizer. | 3.1 |
| 9.2 | XLSX | Добавить `exceljs` **только в server**. Листы Summary/Sales/Supplies/Movements/Payments/Control. | 9.1 |
| 9.3 | Защита | AuditLog на каждый export (успех и 403). Rate 10/10 мин → 429. | 2.3, 9.1 |
| 9.4 | Кнопки на вебе | Summary/sales. OPERATOR без cost-колонок. | 9.1–9.3, 4.4 |

AC: AC-9, AC-20.

---

## Фаза 10: Тесты, архив, приёмка

| # | Задача | Детали | Зависит от |
|---|--------|--------|-------------|
| 10.1 | Сводка integration | Прогнать requirements §32.2 пункты 1–19, которых ещё нет. Regression заказы/склады/возвраты/users. | 5.6, 6.7, 7.2 |
| 10.2 | Archive job | Регистрация рядом со `StagnantProductCronService`. `AUDIT_ARCHIVE_ENABLED=false` → log skip. Purge IdempotencyRecord >24h **включить**. Ручной POST archive может быть 501. Checklist M9: «archive = no-op» явно. | 0.5, 2.4 |
| 10.3 | Ledger UI товара | Страница или вкладка на `/products/:id` для ADMIN. | 3.5, 4.2 |
| 10.4 | Полировка веба | Empty/403/сеть, ru-тексты, адаптив таблиц, lint+build. | 4–6, 9.4 |
| 10.5 | Ручной прогон | Чеклист AC-1…AC-21 тремя аккаунтами: FULL, OPERATOR admin, EMPLOYEE (приёмка на своём складе, нет P&L). FINANCIER если есть тестовый профиль: видит прибыль, receive 403. Не открывать v2-скоуп. | 10.1, 10.4 |

Соответствие приёмке: requirements §33 AC-1…AC-21.

---

## Параллельность

```
0 → 1 → 2 → 3 → 5 → 6 → 7
              ↘ 4 (веб read) ↗ 5.5 UI
6.5 алерты можно после 6.1
8 stretch после 3 или после 10
9 после 3 (CSV) / после 5 (лист Supplies)
10 в конце
```

Один человек: строго 0→1→2→3→4→5→6→7→9→10, 8 по желанию.  
Два человека: A — backend 0–3–5–6–7, B — frontend 2.7+4 параллельно с 3, затем 5.5 / 6.2.

---

## Вне скоупа этого файла (V2/V3)

Камера/BarcodeDetector; мобильная приёмка; меню перемещений; документ `SUPPLY_RETURN` и permission; касса фургона; FIFO; 1С/НДС; отдельный worker архива; партиционирование AuditLog в проде.

---

## Definition of done трека

- Продажа и приход появляются без ручного ввода в бухгалтерии.
- Суперадмин видит P&L; OPERATOR не получает cost в JSON.
- Сторно поставки не уходит в минус и не притворяется партионным учётом.
- Receive идемпотентен.
- `lockStocks` используется на всех многострочных write.
- Нет write `SUPPLY_RETURN`.
- Archive job зарегистрирован как no-op.
- `web/` build зелёный, меню не ломает портал поставщика и пользователей.
