export type UserRole = 'CLIENT' | 'EMPLOYEE' | 'SUPPLIER' | 'ADMIN' | 'DRIVER';

export interface Supplier {
  id: number;
  userId: number;
  companyName: string;
  contactPerson: string;
  phone: string | null;
  address: string | null;
  bankAccount: string | null;
  bik: string | null;
  inn: string | null;
  ogrn: string | null;
}

export interface Employee {
  id: number;
  userId: number;
  name: string;
  position?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface Admin {
  id: number;
  userId: number;
  name: string;
  isSuperAdmin?: boolean;
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
  supplier?: Supplier | null;
  employee?: Employee | null;
  admin?: Admin | null;
}

/** Поля для обновления профиля (Supplier + User или Employee/Admin + User) */
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
