import type { StaffApplicationRole, StaffApplicationStatus } from '@/entities/staff-application';
import type { UserRole } from '@/entities/user';

export interface AdminUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  sortBy?: 'createdAt' | 'updatedAt' | 'email' | 'role';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminStaffListParams {
  page?: number;
  limit?: number;
}

export interface StaffApplicationListParams {
  page?: number;
  limit?: number;
  status?: StaffApplicationStatus;
  desiredRole?: StaffApplicationRole;
  search?: string;
}

export const userManagementKeys = {
  all: ['user-management'] as const,
  list: (params: AdminUsersListParams = {}) => [...userManagementKeys.all, 'list', params] as const,
  staff: (params: AdminStaffListParams = {}) => [...userManagementKeys.all, 'staff', params] as const,
  detail: (userId: number) => [...userManagementKeys.all, 'detail', userId] as const,
  employee: (employeeId: number) => [...userManagementKeys.all, 'employee', employeeId] as const,
  driver: (driverId: number) => [...userManagementKeys.all, 'driver', driverId] as const,
  applications: (params: StaffApplicationListParams = {}) =>
    [...userManagementKeys.all, 'applications', params] as const,
  applicationStats: () => [...userManagementKeys.all, 'application-stats'] as const,
  warehouseSelection: () => [...userManagementKeys.all, 'warehouses-selection'] as const,
  districtSelection: () => [...userManagementKeys.all, 'districts-selection'] as const,
};
