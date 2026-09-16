function pick(map: Record<string, string>, value: unknown): string {
  if (value == null || value === '') return '—';
  const key = String(value);
  return map[key] ?? key;
}

export const SALE_TYPE_LABELS: Record<string, string> = {
  ORDER: 'Заказ',
  STOP: 'Фургон',
  DIRECT: 'Прямая продажа',
};

export const STOCK_OPERATION_LABELS: Record<string, string> = {
  SELL: 'Продажа',
  SUPPLY: 'Поставка',
  ADJUSTMENT: 'Корректировка',
  RETURN: 'Возврат',
  WRITE_OFF: 'Списание',
  TRANSFER_OUT: 'Перемещение: списание',
  TRANSFER_IN: 'Перемещение: приход',
  SUPPLY_REVERSAL: 'Сторно поставки',
  SUPPLY_RETURN: 'Возврат поставки',
  PRICE_CHANGE: 'Изменение цены',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  CART: 'Корзина',
  ORDER: 'Заказ',
  SUPPLY: 'Поставка',
  MANUAL: 'Вручную',
  SYSTEM: 'Система',
  RETURN: 'Возврат',
  INVENTORY_COUNT: 'Инвентаризация',
  TRANSFER: 'Перемещение',
  SUPPLY_REVERSAL: 'Сторно поставки',
  ACCOUNTING: 'Бухгалтерия',
};

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  RECEIVED: 'Проведена',
  CANCELLED: 'Отменена',
  REVERSED: 'Сторно',
  PARTIALLY_REVERSED: 'Частичное сторно',
};

export const SUPPLY_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  RECEIVED: 'green',
  CANCELLED: 'red',
  REVERSED: 'orange',
  PARTIALLY_REVERSED: 'gold',
};

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  COMPLETED: 'Проведена',
  CANCELLED: 'Отменена',
};

export const INVENTORY_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  SUPPLY_RECEIVE: 'Проведение поставки',
  SUPPLY_CANCEL: 'Отмена поставки',
  SUPPLY_REVERSE: 'Сторно поставки',
  INVENTORY_COMPLETE: 'Проведение инвентаризации',
  PRICE_CHANGE: 'Изменение цены',
  SALES_ADJUSTMENT: 'Корректировка продажи',
  TRANSFER_COMPLETE: 'Проведение перемещения',
  ACCOUNTING_PERIOD_CLOSE: 'Закрытие периода',
  ACCOUNTING_PERIOD_REOPEN: 'Повторное открытие периода',
  ACCOUNTING_LATE_ENTRY: 'Проводка в закрытый период',
  ACCOUNTING_EXPORT: 'Экспорт',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  SupplyDocument: 'Поставка',
  InventoryCount: 'Инвентаризация',
  StockTransfer: 'Перемещение',
  ProductStock: 'Остаток',
  SalesAdjustment: 'Корректировка продажи',
  AccountingPeriod: 'Учётный период',
  Export: 'Экспорт',
  SupplyReversal: 'Сторно поставки',
};

export const saleTypeLabel = (value: unknown) => pick(SALE_TYPE_LABELS, value);
export const stockOperationLabel = (value: unknown) => pick(STOCK_OPERATION_LABELS, value);
export const sourceTypeLabel = (value: unknown) => pick(SOURCE_TYPE_LABELS, value);
export const supplyStatusLabel = (value: unknown) => pick(SUPPLY_STATUS_LABELS, value);
export const inventoryStatusLabel = (value: unknown) => pick(INVENTORY_STATUS_LABELS, value);
export const auditActionLabel = (value: unknown) => pick(AUDIT_ACTION_LABELS, value);
export const entityTypeLabel = (value: unknown) => pick(ENTITY_TYPE_LABELS, value);

export function sourceLabel(sourceType: unknown, sourceId?: unknown): string {
  const type = sourceTypeLabel(sourceType);
  if (type === '—') return '—';
  return sourceId ? `${type} №${sourceId}` : type;
}
