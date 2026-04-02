import { apiClient } from '@/shared/api';
import type { Warehouse, WarehouseSummary } from '../model/types';

interface WarehousesListResponse {
  data: {
    warehouses: WarehouseSummary[];
    pagination: { total: number; page: number; limit: number; pages: number };
  };
}

export async function getWarehouses(params: {
  page?: number;
  limit?: number;
  search?: string;
  districtId?: number;
  isActive?: boolean;
} = {}): Promise<{ warehouses: WarehouseSummary[]; total: number }> {
  const { data } = await apiClient.get<WarehousesListResponse>('/api/warehouses', {
    params: { limit: 100, ...params },
  });
  return {
    warehouses: data.data?.warehouses ?? [],
    total: data.data?.pagination?.total ?? 0,
  };
}

export async function getWarehouseById(id: number): Promise<Warehouse> {
  const { data } = await apiClient.get<{ data: { warehouse: Warehouse } }>(
    `/api/warehouses/${id}`,
  );
  const w = data.data?.warehouse ?? (data.data as unknown as Warehouse);
  if (!w) throw new Error('Склад не найден');
  return w;
}
