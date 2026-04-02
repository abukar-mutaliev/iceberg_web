import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { User, ProfileUpdatePayload } from '../model/types';

export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User> & { user?: User; data?: User | { user?: User } }>('/api/profile');
  let user = data.data ?? data.user;
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    if ('user' in user && typeof (user as { user?: User }).user === 'object') {
      user = (user as { user: User }).user;
    }
    return user as User;
  }
  throw new Error((data as { message?: string }).message ?? 'Не удалось загрузить профиль');
}

/** Подготовка payload: пустые строки для опциональных полей не отправляем (или null для сброса). */
function sanitizeProfilePayload(payload: ProfileUpdatePayload): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const isEmpty = value === null || value === '' || (typeof value === 'string' && value.trim() === '');
    const optionalSetNull = ['inn', 'ogrn', 'bankAccount', 'bik', 'address', 'phone', 'position'];
    if (isEmpty && optionalSetNull.includes(key)) {
      result[key] = null;
      continue;
    }
    if (isEmpty && ['email'].includes(key)) continue;
    result[key] = value;
  }
  return result;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
  const sanitized = sanitizeProfilePayload(payload);
  const { data } = await apiClient.put<ApiResponse<User> & { errors?: unknown[] }>('/api/profile', sanitized);
  if (data.data) return data.data as User;
  const errMsgs = Array.isArray(data.errors) ? data.errors.map((e) => (e as { msg?: string }).msg).filter((m): m is string => Boolean(m)) : [];
  const msg = data.message ?? (errMsgs.length > 0 ? errMsgs.join('; ') : null) ?? 'Не удалось обновить профиль';
  throw new Error(msg);
}

export interface SupplierListItem {
  id: number;
  companyName: string;
  contactPerson: string;
  phone?: string | null;
}

interface SupplierUserRow {
  id?: number;
  supplier?: {
    id: number;
    companyName: string;
    contactPerson: string;
    phone?: string | null;
  } | null;
}

export async function getSuppliers(search?: string): Promise<SupplierListItem[]> {
  const { data } = await apiClient.get<{
    status?: string;
    data?: { staff?: SupplierUserRow[] };
  }>('/api/users/suppliers', { params: { limit: 50, page: 1, ...(search ? { search } : {}) } });

  const staff = data?.data?.staff ?? [];
  return staff
    .filter((u): u is SupplierUserRow & { supplier: NonNullable<SupplierUserRow['supplier']> } =>
      u.supplier != null,
    )
    .map((u) => ({
      id: u.supplier.id,
      companyName: u.supplier.companyName,
      contactPerson: u.supplier.contactPerson,
      phone: u.supplier.phone ?? null,
    }));
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await apiClient.put<ApiResponse<unknown>>('/api/profile/password', {
    currentPassword,
    newPassword,
  });
  if (data.status !== 'success') {
    throw new Error(data.message ?? 'Не удалось сменить пароль');
  }
}

type EmailBindInitResponse = ApiResponse<{ bindToken?: string }> & { bindToken?: string; data?: { bindToken?: string } };

async function requestWithFallback<T>(
  paths: string[],
  payload: Record<string, unknown>,
): Promise<T> {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const { data } = await apiClient.post<T>(path, payload);
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Не удалось выполнить запрос');
}

export async function initiateEmailChange(email: string): Promise<{ bindToken: string }> {
  const data = await requestWithFallback<EmailBindInitResponse>(
    [
      '/api/profile/email/bind/initiate',
      '/api/profile/email/initiate-bind',
      '/api/profile/email-bind/initiate',
    ],
    { email },
  );

  const bindToken = data.bindToken ?? data.data?.bindToken;
  if (!bindToken) {
    throw new Error(data.message ?? 'Не удалось получить токен подтверждения');
  }

  return { bindToken };
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await apiClient.post<ApiResponse<User> & { user?: User }>('/api/profile/avatar', form);
  const user = data.data ?? data.user;
  if (user) return user as User;
  throw new Error(data.message ?? 'Не удалось загрузить аватар');
}

export async function confirmEmailChange(bindToken: string, verificationCode: string): Promise<void> {
  const data = await requestWithFallback<ApiResponse<unknown>>(
    [
      '/api/profile/email/bind/confirm',
      '/api/profile/email/confirm-bind',
      '/api/profile/email-bind/confirm',
    ],
    { bindToken, verificationCode },
  );

  if (data.status !== 'success') {
    throw new Error(data.message ?? 'Не удалось подтвердить email');
  }
}
