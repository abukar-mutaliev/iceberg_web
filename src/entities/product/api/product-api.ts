import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { Product, ProductsListParams, ProductsListResponse, Category } from '../model/types';

/** Список своих продуктов (для поставщика — только свои). Бэкенд: { data: Product[], pagination }. */
export async function getProducts(params: ProductsListParams = {}): Promise<ProductsListResponse> {
  const { page = 1, limit = 10, moderationStatus } = params;
  const { data } = await apiClient.get<{ status?: string; data?: Product[]; pagination?: ProductsListResponse['pagination'] }>(
    '/api/products',
    { params: { page, limit, ...(moderationStatus ? { moderationStatus } : {}) } }
  );
  return {
    data: data.data ?? [],
    pagination: data.pagination ?? { currentPage: page, totalPages: 1, totalItems: 0 },
  };
}

/** Один продукт по ID. */
export async function getProductById(id: number): Promise<Product> {
  const { data } = await apiClient.get<ApiResponse<Product>>(`/api/products/${id}`);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Продукт не найден');
}

/** Создание продукта. multipart/form-data: name, description, price, itemsPerBox, boxPrice, stockQuantity, weight, categories (JSON array), images (файлы). */
export async function createProduct(formData: FormData): Promise<Product> {
  const { data } = await apiClient.post<ApiResponse<Product>>('/api/products', formData);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Не удалось создать продукт');
}

/** Обновление продукта. multipart/form-data. При изменении продукт снова уходит на модерацию. */
export async function updateProduct(id: number, formData: FormData): Promise<Product> {
  const { data } = await apiClient.put<ApiResponse<Product>>(`/api/products/${id}`, formData);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Не удалось обновить продукт');
}

/** Удаление продукта. */
export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/api/products/${id}`);
}

export interface ModerateProductApprove {
  action: 'approve';
  price: number;
  boxPrice?: number;
  reason?: string;
}

export interface ModerateProductReject {
  action: 'reject';
  reason: string;
}

export type ModerateProductPayload = ModerateProductApprove | ModerateProductReject;

/** Модерация продукта (только ADMIN). */
export async function moderateProduct(id: number, payload: ModerateProductPayload): Promise<Product> {
  const { data } = await apiClient.patch<{ status?: string; data?: { product: Product }; message?: string }>(
    `/api/products/${id}/moderate`,
    payload,
  );
  if (data.data?.product) return data.data.product;
  throw new Error(data.message ?? 'Не удалось выполнить модерацию');
}

/** Список категорий для формы продукта. Бэкенд: { data: { categories: Category[] } }. */
export async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get<{ status?: string; data?: { categories?: Category[] }; categories?: Category[] }>('/api/categories');
    const list = data?.data?.categories ?? data?.categories ?? data?.data;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
