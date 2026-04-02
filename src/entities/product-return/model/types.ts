export type ProductReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProductReturnProduct {
  id: number;
  name: string;
}

export interface ProductReturnWarehouse {
  id: number;
  name?: string;
  address?: string;
}

export interface ProductReturn {
  id: number;
  productId: number;
  product?: ProductReturnProduct;
  warehouseId: number;
  warehouse?: ProductReturnWarehouse;
  quantity: number;
  reason?: string | null;
  status: ProductReturnStatus;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export const RETURN_STATUS_LABELS: Record<ProductReturnStatus, string> = {
  PENDING: 'Ожидает',
  APPROVED: 'Одобрен',
  REJECTED: 'Отклонён',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершён',
};

export interface ProductReturnsListParams {
  page?: number;
  limit?: number;
  status?: ProductReturnStatus;
  warehouseId?: number;
  productId?: number;
}

export interface ProductReturnsListResponse {
  data: ProductReturn[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasMore?: boolean;
  };
}
