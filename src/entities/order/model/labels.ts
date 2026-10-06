import type { OrderStatus } from './types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Ожидает обработки',
  PENDING_PAYMENT: 'Ожидает оплату',
  AWAITING_CONFIRMATION: 'Ожидает подтверждения',
  CONFIRMED: 'Подтвержден',
  WAITING_STOCK: 'Ожидает поступления',
  PICKING: 'Сборка',
  PACKING: 'Упаковка',
  IN_DELIVERY: 'В доставке',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
  RETURNED: 'Возвращен',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'default',
  PENDING_PAYMENT: 'gold',
  AWAITING_CONFIRMATION: 'blue',
  CONFIRMED: 'cyan',
  WAITING_STOCK: 'orange',
  PICKING: 'processing',
  PACKING: 'processing',
  IN_DELIVERY: 'purple',
  DELIVERED: 'success',
  CANCELLED: 'error',
  RETURNED: 'magenta',
};

export const ORDER_QUEUE_TABS: { key: OrderStatus | ''; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'AWAITING_CONFIRMATION', label: 'Взвешивание' },
  { key: 'PENDING_PAYMENT', label: 'Ждут оплату' },
  { key: 'PICKING', label: 'Сборка' },
  { key: 'IN_DELIVERY', label: 'В доставке' },
  { key: 'WAITING_STOCK', label: 'Ждут товар' },
  { key: 'DELIVERED', label: 'Доставлены' },
  { key: 'CANCELLED', label: 'Отменены' },
];

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  COMPLETED: 'Оплачен',
  FAILED: 'Ошибка',
  REFUNDED: 'Возврат',
  CANCELLED: 'Отменён',
};

export const CHOICE_TYPE_LABELS: Record<string, string> = {
  STOCK_UNAVAILABLE: 'Нет на складе',
  DELIVERY_DISTANCE: 'Доставка',
  PARTIAL_AVAILABILITY: 'Частично в наличии',
  PRODUCT_SUBSTITUTE: 'Замена товара',
};

export const CHOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает ответ',
  ACCEPTED: 'Принято',
  REJECTED: 'Отклонено',
  EXPIRED: 'Истекло',
  CANCELLED: 'Отменено',
};

export const ORDER_LOG_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Смена статуса',
  PRICE_CONFIRMATION: 'Подтверждение цены',
  ORDER_CANCELLATION: 'Отмена',
  ORDER_CREATION: 'Создание',
  ORDER_PICKING_SCANNED: 'Скан сборки',
};

export function isOrderPaid(payment: { status?: string; paidAt?: string | null; completedAt?: string | null } | null | undefined): boolean {
  if (!payment) return false;
  if (payment.status === 'COMPLETED') return true;
  return Boolean(payment.paidAt || payment.completedAt);
}
