import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { NamedRef } from '@/entities/user';
import { toNamedRef } from './adapters';
import { requestApi } from './request';

export async function getDriverDistricts(driverId: number): Promise<NamedRef[]> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<unknown[]>>('/api/drivers/districts', {
      params: { driverId },
    });
    const rows = Array.isArray(data.data) ? data.data : [];
    return rows.map(toNamedRef).filter((item): item is NamedRef => item != null);
  })());
}

export async function updateDriverDistricts(
  driverId: number,
  districts: number[],
): Promise<{ districts: NamedRef[]; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.put<ApiResponse<unknown[]>>('/api/drivers/districts', {
      driverId,
      districts,
    });
    const rows = Array.isArray(data.data) ? data.data : [];
    return {
      districts: rows.map(toNamedRef).filter((item): item is NamedRef => item != null),
      message: data.message ?? 'Районы успешно обновлены',
    };
  })());
}

export async function getDriverWarehouse(driverId: number): Promise<NamedRef | null> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<unknown>>('/api/drivers/warehouse', {
      params: { driverId },
    });
    return toNamedRef(data.data);
  })());
}

export async function updateDriverWarehouse(
  driverId: number,
  warehouseId: number | null,
): Promise<{ warehouse: NamedRef | null; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.put<ApiResponse<{ warehouse?: unknown }>>('/api/drivers/warehouse', {
      driverId,
      warehouseId,
    });
    const payload = data.data;
    const warehouse = toNamedRef(
      payload && typeof payload === 'object' && 'warehouse' in payload
        ? payload.warehouse
        : payload,
    );
    return {
      warehouse,
      message: data.message ?? 'Склад водителя успешно обновлен',
    };
  })());
}
