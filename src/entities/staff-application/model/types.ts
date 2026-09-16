export type StaffApplicationRole = 'EMPLOYEE' | 'SUPPLIER' | 'DRIVER';
export type StaffApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StaffApplicationUser {
  id: number;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  client?: {
    id: number;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
}

export interface StaffApplication {
  id: number;
  userId: number;
  desiredRole: StaffApplicationRole;
  status: StaffApplicationStatus;
  reason?: string | null;
  experience?: string | null;
  additionalInfo?: string | null;
  /** На сервере JSON-строка массива id районов. */
  districts?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: StaffApplicationUser | null;
}

export interface StaffApplicationPayload {
  desiredRole: StaffApplicationRole;
  districts?: number[];
  reason?: string;
  experience?: string;
  additionalInfo?: string;
}
