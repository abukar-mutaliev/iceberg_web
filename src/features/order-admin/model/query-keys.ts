export interface OrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  warehouseId?: number;
  assignedToId?: number;
  urgent?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export const orderAdminKeys = {
  all: ['order-admin'] as const,
  lists: () => [...orderAdminKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderAdminKeys.lists(), params] as const,
  detail: (id: number) => [...orderAdminKeys.all, 'detail', id] as const,
  receipt: (id: number) => [...orderAdminKeys.all, 'receipt', id] as const,
  workload: (warehouseId: number) => [...orderAdminKeys.all, 'workload', warehouseId] as const,
  employees: () => [...orderAdminKeys.all, 'employees'] as const,
};
