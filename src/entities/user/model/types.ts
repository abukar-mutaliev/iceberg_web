export type UserRole = 'CLIENT' | 'EMPLOYEE' | 'SUPPLIER' | 'ADMIN' | 'DRIVER';

export type ProcessingRole =
  | 'PICKER'
  | 'PACKER'
  | 'QUALITY_CHECKER'
  | 'COURIER'
  | 'SUPERVISOR'
  | 'MANAGER';

export interface NamedRef {
  id: number;
  name: string;
}

export interface Supplier {
  id: number;
  userId?: number;
  companyName: string;
  contactPerson: string;
  phone?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  bik?: string | null;
  inn?: string | null;
  ogrn?: string | null;
  productsCount?: number;
  suppliesCount?: number;
}

export interface Employee {
  id: number;
  userId?: number;
  name: string;
  position?: string | null;
  phone?: string | null;
  address?: string | null;
  processingRole?: ProcessingRole | null;
  warehouseId?: number | null;
  warehouse?: NamedRef | null;
  warehouses?: NamedRef[];
  districts?: NamedRef[];
  tasksCount?: number;
}

export interface Admin {
  id: number;
  userId?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  isSuperAdmin?: boolean;
  accountingProfile?: AccountingProfile;
}

export type AccountingProfile = 'OPERATOR' | 'FINANCIER' | 'FULL';

export interface Driver {
  id: number;
  userId?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  warehouseId?: number | null;
  warehouse?: NamedRef | null;
  districts?: NamedRef[];
  stopsCount?: number;
}

export interface Client {
  id: number;
  userId?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  districtId?: number | null;
  district?: NamedRef | null;
  ordersCount?: number;
}

export interface User {
  id: number;
  email: string | null;
  emailVerifiedAt?: string | null;
  phone: string | null;
  phoneVerifiedAt?: string | null;
  role: UserRole;
  avatar: string | null;
  gender?: string | null;
  profileCompletedAt?: string | null;
  twoFactorEnabled?: boolean;
  passwordSet?: boolean;
  lastSeenAt?: string | null;
  supplier?: Supplier | null;
  employee?: Employee | null;
  admin?: Admin | null;
  driver?: Driver | null;
  client?: Client | null;
}

export type AdminUserProfile =
  | { kind: 'ADMIN'; data: Admin }
  | { kind: 'CLIENT'; data: Client }
  | { kind: 'EMPLOYEE'; data: Employee }
  | { kind: 'SUPPLIER'; data: Supplier }
  | { kind: 'DRIVER'; data: Driver }
  | { kind: 'UNKNOWN' };

/** Нормализованная строка реестра пользователей. `userId` = User.id. */
export interface AdminUserListItem {
  userId: number;
  email: string | null;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled: boolean;
  profileCompletedAt: string | null;
  isSuperAdmin: boolean;
  displayName: string;
  contactPhone: string | null;
  profile: AdminUserProfile;
}

/**
 * Карточка пользователя.
 * employeeId / driverId / adminRecordId — id профильных таблиц, не User.id.
 */
export interface UserDetail extends AdminUserListItem {
  loginPhone: string | null;
  lastSeenAt: string | null;
  gender: string | null;
  passwordSet?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  employeeId: number | null;
  driverId: number | null;
  adminRecordId: number | null;
}

/** Поля для обновления своего профиля (Supplier + User или Employee/Admin + User) */
export interface ProfileUpdatePayload {
  email?: string | null;
  name?: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string | null;
  address?: string | null;
  inn?: string | null;
  ogrn?: string | null;
  bankAccount?: string | null;
  bik?: string | null;
  position?: string | null;
}
