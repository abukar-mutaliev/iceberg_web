import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';

export type StaffApplicationRole = 'EMPLOYEE' | 'SUPPLIER' | 'DRIVER';
export type StaffApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StaffApplication {
  id: number;
  userId: number;
  desiredRole: StaffApplicationRole;
  status: StaffApplicationStatus;
  reason?: string | null;
  experience?: string | null;
  additionalInfo?: string | null;
  districts?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffApplicationPayload {
  desiredRole: StaffApplicationRole;
  districts?: number[];
  reason?: string;
  experience?: string;
  additionalInfo?: string;
}

export async function getMyStaffApplication(): Promise<StaffApplication | null> {
  const { data } = await apiClient.get<ApiResponse<{ application?: StaffApplication | null }>>('/api/staff-applications/me');
  return data.data?.application ?? null;
}

export async function applyForStaff(payload: StaffApplicationPayload): Promise<StaffApplication> {
  const sanitizedPayload: StaffApplicationPayload = {
    desiredRole: payload.desiredRole,
    ...(payload.districts && payload.districts.length > 0 ? { districts: payload.districts } : {}),
    ...(payload.reason?.trim() ? { reason: payload.reason.trim() } : {}),
    ...(payload.experience?.trim() ? { experience: payload.experience.trim() } : {}),
    ...(payload.additionalInfo?.trim() ? { additionalInfo: payload.additionalInfo.trim() } : {}),
  };

  const { data } = await apiClient.post<ApiResponse<{ application?: StaffApplication }>>('/api/staff-applications/apply', sanitizedPayload);
  const application = data.data?.application;
  if (!application) {
    throw new Error(data.message ?? 'Не удалось отправить заявку');
  }
  return application;
}
