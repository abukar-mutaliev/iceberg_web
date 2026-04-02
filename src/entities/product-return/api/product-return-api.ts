import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type {
  ProductReturn,
  ProductReturnsListParams,
  ProductReturnsListResponse,
} from '../model/types';

/** Список возвратов (для поставщика — только свои). */
export async function getReturnHistory(
  params: ProductReturnsListParams = {}
): Promise<ProductReturnsListResponse> {
  const { page = 1, limit = 10, status, warehouseId, productId } = params;
  try {
    const searchParams = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) searchParams.set('status', status);
    if (warehouseId) searchParams.set('warehouseId', String(warehouseId));
    if (productId) searchParams.set('productId', String(productId));
    const query = searchParams.toString();
    const { data } = await apiClient.get<{
      status?: string;
      data?: ProductReturn[] | { productReturns?: ProductReturn[]; items?: ProductReturn[] };
      pagination?: ProductReturnsListResponse['pagination'];
    }>(`/api/product-returns${query ? `?${query}` : ''}`);
    let list: ProductReturn[] = [];
    const d = data?.data;
    if (Array.isArray(d)) list = d;
    else if (d && typeof d === 'object') {
      const arr = (d as { productReturns?: ProductReturn[]; items?: ProductReturn[] }).productReturns ?? (d as { items?: ProductReturn[] }).items;
      if (Array.isArray(arr)) list = arr;
    }
    return {
      data: list,
      pagination: data?.pagination ?? { currentPage: page, totalPages: 1, totalItems: 0 },
    };
  } catch {
    return {
      data: [],
      pagination: { currentPage: page, totalPages: 1, totalItems: 0 },
    };
  }
}

/** Детали возврата. */
export async function getReturnById(id: number): Promise<ProductReturn> {
  const { data } = await apiClient.get<ApiResponse<ProductReturn>>(`/api/product-returns/${id}`);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Возврат не найден');
}

/** Начать возврат (перевести в IN_PROGRESS). Только при статусе APPROVED. */
export async function startReturn(id: number): Promise<ProductReturn> {
  const { data } = await apiClient.put<ApiResponse<ProductReturn>>(`/api/product-returns/${id}/start`);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Не удалось начать возврат');
}
