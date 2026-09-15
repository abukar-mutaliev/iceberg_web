import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { AdminUserListItem, UserDetail, UserRole } from '@/entities/user';
import { adminStaffRowToItem, adminUsersRowToItem, createdUserId, userByIdToDetail } from './adapters';
import { compactParams, requestApi, toRequestBody } from './request';
import type {
  ChangeRolePayload,
  CreateAdminPayload,
  CreateStaffPayload,
  PaginatedList,
} from '../model/types';
import type { AdminStaffListParams, AdminUsersListParams } from '../model/query-keys';

function toPaginated(
  rows: unknown[],
  meta: { total?: number; page?: number; pages?: number },
  mapRow: (row: unknown) => AdminUserListItem | null,
): PaginatedList<AdminUserListItem> {
  const items = rows.map(mapRow).filter((item): item is AdminUserListItem => item != null);
  return {
    items,
    total: meta.total ?? items.length,
    page: meta.page ?? 1,
    pages: meta.pages ?? 1,
  };
}

export async function getAdminUsers(
  params: AdminUsersListParams = {},
): Promise<PaginatedList<AdminUserListItem>> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{
      users?: unknown[];
      total?: number;
      page?: number;
      pages?: number;
    }>>('/api/admin/users', {
      params: compactParams({
        page: params.page,
        limit: params.limit,
        search: params.search,
        role: params.role,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      }),
    });
    return toPaginated(data.data?.users ?? [], data.data ?? {}, adminUsersRowToItem);
  })());
}

export async function getAdminStaff(
  params: AdminStaffListParams = {},
): Promise<PaginatedList<AdminUserListItem>> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{
      staff?: unknown[];
      total?: number;
      page?: number;
      pages?: number;
    }>>('/api/admin/staff', {
      params: compactParams({ page: params.page, limit: params.limit }),
    });
    return toPaginated(data.data?.staff ?? [], data.data ?? {}, adminStaffRowToItem);
  })());
}

export async function getAdminUser(userId: number): Promise<UserDetail> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{ user?: unknown }>>(`/api/users/${userId}`);
    const detail = userByIdToDetail(data);
    if (!detail.userId) {
      throw new Error('Пользователь не найден');
    }
    return detail;
  })());
}

export async function createAdmin(
  payload: CreateAdminPayload,
): Promise<{ userId: number; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.post<ApiResponse<{ admin?: { id?: number } }>>(
      '/api/admin/admins',
      toRequestBody({ ...payload }),
    );
    const userId = createdUserId(data, 'admin');
    if (userId == null) throw new Error(data.message ?? 'Не удалось создать администратора');
    return { userId, message: data.message ?? 'Администратор успешно создан' };
  })());
}

export async function createStaff(
  payload: CreateStaffPayload,
): Promise<{ userId: number; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.post<ApiResponse<{ staff?: { id?: number } }>>(
      '/api/admin/staff',
      toRequestBody({ ...payload }),
    );
    const userId = createdUserId(data, 'staff');
    if (userId == null) throw new Error(data.message ?? 'Не удалось создать пользователя');
    return { userId, message: data.message ?? 'Пользователь успешно создан' };
  })());
}

export async function changeUserRole(userId: number, payload: ChangeRolePayload): Promise<string> {
  return requestApi((async () => {
    const { data } = await apiClient.patch<ApiResponse<unknown>>(
      `/api/admin/change-role/${userId}`,
      toRequestBody({ ...payload }),
    );
    return data.message ?? 'Роль пользователя изменена';
  })());
}

/** `adminId` в пути API — это User.id. */
export async function deleteAdminUser(userId: number): Promise<string> {
  return requestApi((async () => {
    const { data } = await apiClient.delete<ApiResponse<unknown>>(`/api/admin/admins/${userId}`);
    return data.message ?? 'Администратор успешно удален';
  })());
}

export async function deleteStaffUser(userId: number): Promise<string> {
  return requestApi((async () => {
    const { data } = await apiClient.delete<ApiResponse<unknown>>(`/api/admin/staff/${userId}`);
    return data.message ?? 'Пользователь успешно удален';
  })());
}

export async function deleteManagedUser(userId: number, role: UserRole): Promise<string> {
  return role === 'ADMIN' ? deleteAdminUser(userId) : deleteStaffUser(userId);
}
