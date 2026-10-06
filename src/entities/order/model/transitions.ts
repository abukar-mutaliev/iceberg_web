import type { OrderStatus } from './types';

/** Совпадает с ALLOWED_TRANSITIONS в orderLifecycle.js. Сервер всё равно проверяет переход. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_CONFIRMATION: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'PICKING', 'IN_DELIVERY', 'WAITING_STOCK', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'IN_DELIVERY', 'WAITING_STOCK', 'CANCELLED'],
  WAITING_STOCK: ['CONFIRMED', 'CANCELLED'],
  PICKING: ['IN_DELIVERY', 'CANCELLED'],
  PACKING: ['IN_DELIVERY', 'PICKING', 'CANCELLED'],
  IN_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const STAFF_CANCELLABLE: OrderStatus[] = [
  'AWAITING_CONFIRMATION',
  'PENDING_PAYMENT',
  'PENDING',
  'CONFIRMED',
  'WAITING_STOCK',
  'PICKING',
  'IN_DELIVERY',
];

export const PRE_DELIVERY_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PICKING', 'PACKING'];

export function canStaffCancel(status: OrderStatus): boolean {
  return STAFF_CANCELLABLE.includes(status);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

const FULFILLMENT_STATUSES = new Set<OrderStatus>(['PICKING', 'PACKING', 'IN_DELIVERY', 'DELIVERED']);

/**
 * Статусы, которые суперадмин может поставить за сотрудника.
 * Отмена остаётся отдельной кнопкой. Оплату и взвешивание так не пропускаем.
 */
export function superAdminStatusOptions(status: OrderStatus, paid: boolean): OrderStatus[] {
  return (ALLOWED_TRANSITIONS[status] ?? []).filter((next) => {
    if (next === 'CANCELLED') return false;
    if (status === 'AWAITING_CONFIRMATION') return false;
    if (status === 'PENDING_PAYMENT' && next === 'PENDING') return false;
    if (!paid && FULFILLMENT_STATUSES.has(next)) return false;
    return true;
  });
}
