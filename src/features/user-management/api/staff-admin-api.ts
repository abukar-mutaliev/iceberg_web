import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { StaffApplication, StaffApplicationRole } from '@/entities/staff-application';
import { compactParams, requestApi, toRequestBody } from './request';
import type { ApproveStaffApplicationPayload, PaginatedList } from '../model/types';
import type { StaffApplicationListParams } from '../model/query-keys';

export interface StaffApplicationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byRole: Partial<Record<StaffApplicationRole, number>>;
}

export interface StaffApplicationListItem extends StaffApplication {
  districtIds: number[];
}

export function parseApplicationDistricts(raw: unknown): number[] {
  if (raw == null || raw === '') return [];

  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  const ids = new Set<number>();
  for (const item of value) {
    if (typeof item === 'number' && Number.isInteger(item) && item > 0) {
      ids.add(item);
      continue;
    }
    if (typeof item === 'string' && /^\d+$/.test(item)) {
      ids.add(Number(item));
      continue;
    }
    if (item && typeof item === 'object' && 'id' in item) {
      const id = Number((item as { id: unknown }).id);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
  }

  return [...ids];
}

function toListItem(row: StaffApplication): StaffApplicationListItem {
  return {
    ...row,
    districtIds: parseApplicationDistricts(row.districts),
  };
}

export async function getStaffApplications(
  params: StaffApplicationListParams = {},
): Promise<PaginatedList<StaffApplicationListItem>> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{
      applications?: StaffApplication[];
      total?: number;
      page?: number;
      pages?: number;
    }>>('/api/admin/staff-applications', {
      params: compactParams({
        page: params.page,
        limit: params.limit,
        status: params.status,
        desiredRole: params.desiredRole,
        search: params.search,
      }),
    });

    const items = (data.data?.applications ?? []).map(toListItem);
    return {
      items,
      total: data.data?.total ?? items.length,
      page: data.data?.page ?? 1,
      pages: data.data?.pages ?? 1,
    };
  })());
}

export async function getStaffApplicationStats(): Promise<StaffApplicationStats> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<StaffApplicationStats>>(
      '/api/admin/staff-applications/statistics',
    );
    return {
      total: data.data?.total ?? 0,
      pending: data.data?.pending ?? 0,
      approved: data.data?.approved ?? 0,
      rejected: data.data?.rejected ?? 0,
      byRole: data.data?.byRole ?? {},
    };
  })());
}

export async function approveStaffApplication(
  applicationId: number,
  payload: ApproveStaffApplicationPayload = {},
): Promise<string> {
  return requestApi((async () => {
    const { data } = await apiClient.post<ApiResponse<unknown>>(
      `/api/admin/staff-applications/${applicationId}/approve`,
      toRequestBody({ ...payload }),
    );
    return data.message ?? 'Заявка одобрена';
  })());
}

export async function rejectStaffApplication(
  applicationId: number,
  rejectionReason: string,
): Promise<string> {
  return requestApi((async () => {
    const { data } = await apiClient.post<ApiResponse<unknown>>(
      `/api/admin/staff-applications/${applicationId}/reject`,
      { rejectionReason },
    );
    return data.message ?? 'Заявка отклонена';
  })());
}
