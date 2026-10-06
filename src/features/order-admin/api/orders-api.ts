import { apiClient } from '@/shared/api';
import { getApiMessage } from '@/shared/lib';
import type {
  ConfirmPricePayload,
  OrderAssignee,
  OrderDetail,
  OrderReceiptView,
  OrderStatus,
  OrdersListResult,
  WorkloadEmployee,
} from '@/entities/order';
import type { OrderListParams } from '../model/query-keys';

function cleanParams(params: OrderListParams): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.status) query.status = params.status;
  if (params.warehouseId) query.warehouseId = params.warehouseId;
  if (params.assignedToId) query.assignedToId = params.assignedToId;
  if (params.urgent) query.urgent = true;
  if (params.search) query.search = params.search;
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;
  return query;
}

export async function getOrders(params: OrderListParams = {}): Promise<OrdersListResult> {
  const { data } = await apiClient.get<{
    data?: OrdersListResult['data'];
    pagination?: OrdersListResult['pagination'];
  }>('/api/orders', { params: cleanParams(params) });

  return {
    data: data.data ?? [],
    pagination: data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: data.data?.length ?? 0,
      pages: 1,
    },
  };
}

export async function getOrder(id: number): Promise<OrderDetail> {
  const { data } = await apiClient.get<{ data: OrderDetail }>(`/api/orders/${id}`);
  if (!data.data) throw new Error('Заказ не найден');
  return data.data;
}

export async function getOrderReceipt(orderId: number): Promise<OrderReceiptView> {
  const { data } = await apiClient.get<{ data: OrderReceiptView }>(
    `/api/payments/orders/${orderId}/receipt`,
  );
  return data.data;
}

export async function getWarehouseWorkload(warehouseId: number): Promise<WorkloadEmployee[]> {
  const { data } = await apiClient.get<{ data?: { employees?: WorkloadEmployee[] } }>(
    `/api/orders/warehouses/${warehouseId}/workload`,
  );
  return data.data?.employees ?? [];
}

interface EmployeeRow {
  id: number;
  name: string;
  position?: string | null;
  processingRole?: string | null;
  phone?: string | null;
}

export async function getStaffEmployees(): Promise<OrderAssignee[]> {
  const { data } = await apiClient.get<{ data?: { employees?: EmployeeRow[] } }>(
    '/api/employees/all',
    { params: { limit: 50, page: 1 } },
  );
  return (data.data?.employees ?? []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    position: employee.position,
    processingRole: employee.processingRole,
    phone: employee.phone,
  }));
}

export async function confirmOrderPrice(orderId: number, payload: ConfirmPricePayload): Promise<OrderDetail> {
  const { data } = await apiClient.patch<{ data?: { order?: OrderDetail } }>(
    `/api/orders/${orderId}/confirm-price`,
    payload,
  );
  if (!data.data?.order) {
    return getOrder(orderId);
  }
  return data.data.order;
}

export async function verifyPickingScan(orderId: number, token: string): Promise<void> {
  await apiClient.post(`/api/orders/${orderId}/picking/scan`, { token });
}

export async function completeOrderStage(orderId: number, comment?: string): Promise<void> {
  await apiClient.patch(`/api/orders/${orderId}/complete-stage`, {
    ...(comment ? { comment } : {}),
  });
}

export async function assignOrder(
  orderId: number,
  assignedToId: number | null,
  reason?: string,
): Promise<void> {
  await apiClient.patch(`/api/orders/${orderId}/assign`, {
    assignedToId,
    ...(reason ? { reason } : {}),
  });
}

export async function cancelOrder(orderId: number, reason: string): Promise<void> {
  await apiClient.patch(`/api/orders/${orderId}/cancel`, { reason });
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  comment?: string,
): Promise<void> {
  await apiClient.patch(`/api/orders/${orderId}/status`, {
    status,
    ...(comment ? { comment } : {}),
  });
}

export async function downloadOrderInvoice(orderId: number, orderNumber: string): Promise<void> {
  try {
    const response = await apiClient.get<Blob>(`/api/orders/${orderId}/invoice`, {
      responseType: 'blob',
    });
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${orderNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(getApiMessage(error));
  }
}
