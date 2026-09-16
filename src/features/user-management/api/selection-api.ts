import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { NamedRef } from '@/entities/user';
import { toNamedRef } from './adapters';
import { compactParams, requestApi } from './request';

export interface WarehouseSelectionItem {
  id: number;
  name: string;
  address?: string | null;
  district: NamedRef | null;
  employeesCount: number;
  isActive?: boolean;
}

export interface DistrictSelectionItem {
  id: number;
  name: string;
  description?: string | null;
  stats: {
    warehousesCount: number;
    clientsCount: number;
    driversCount: number;
    employeesCount: number;
  };
}

export async function getWarehousesForSelection(options: {
  includeInactive?: boolean;
} = {}): Promise<WarehouseSelectionItem[]> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{ warehouses?: WarehouseSelectionItem[] }>>(
      '/api/admin/warehouses/selection',
      { params: compactParams({ includeInactive: options.includeInactive ? 'true' : undefined }) },
    );
    return (data.data?.warehouses ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address ?? null,
      district: toNamedRef(row.district),
      employeesCount: row.employeesCount ?? 0,
      isActive: row.isActive,
    }));
  })());
}

export async function getDistrictsForSelection(): Promise<DistrictSelectionItem[]> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{ districts?: DistrictSelectionItem[] }>>(
      '/api/admin/districts/selection',
    );
    return (data.data?.districts ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      stats: {
        warehousesCount: row.stats?.warehousesCount ?? 0,
        clientsCount: row.stats?.clientsCount ?? 0,
        driversCount: row.stats?.driversCount ?? 0,
        employeesCount: row.stats?.employeesCount ?? 0,
      },
    }));
  })());
}
