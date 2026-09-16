import type { ProcessingRole, UserRole } from '@/entities/user';

export interface CreateAdminPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface CreateStaffPayload {
  role: Exclude<UserRole, 'ADMIN'>;
  email: string;
  password: string;
  name?: string;
  phone?: string;
  address?: string;
  position?: string;
  warehouseId?: number;
  warehouseIds?: number[];
  allWarehouses?: boolean;
  districts?: number[];
  districtId?: number;
  companyName?: string;
  contactPerson?: string;
  inn?: string;
  ogrn?: string;
  bankAccount?: string;
  bik?: string;
}

export interface ChangeRolePayload {
  newRole: UserRole;
  isSuperAdmin?: boolean;
  name?: string;
  phone?: string;
  address?: string;
  position?: string;
  processingRole?: ProcessingRole;
  warehouseId?: number;
  warehouseIds?: number[];
  allWarehouses?: boolean;
  districts?: number[];
  districtId?: number;
  companyName?: string;
  contactPerson?: string;
  inn?: string;
  ogrn?: string;
  bankAccount?: string;
  bik?: string;
}

export interface ApproveStaffApplicationPayload {
  position?: string;
  warehouseId?: number;
  warehouseIds?: number[];
  allWarehouses?: boolean;
  districts?: number[];
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
