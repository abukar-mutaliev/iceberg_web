import {
  getUserDisplayName,
  normalizeContactPhone,
  UNSPECIFIED_CONTACT,
  type Admin,
  type AdminUserListItem,
  type AdminUserProfile,
  type Client,
  type Driver,
  type Employee,
  type NamedRef,
  type ProcessingRole,
  type Supplier,
  type UserDetail,
  type UserRole,
} from '@/entities/user';

const USER_ROLES: UserRole[] = ['CLIENT', 'EMPLOYEE', 'SUPPLIER', 'ADMIN', 'DRIVER'];
const PROCESSING_ROLES: ProcessingRole[] = [
  'PICKER',
  'PACKER',
  'QUALITY_CHECKER',
  'COURIER',
  'SUPERVISOR',
  'MANAGER',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeOptionalText(value: unknown): string | null {
  const text = asString(value)?.trim() ?? '';
  if (!text || text === UNSPECIFIED_CONTACT) return null;
  return text;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asUserRole(value: unknown): UserRole | null {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

function asProcessingRole(value: unknown): ProcessingRole | null {
  return typeof value === 'string' && PROCESSING_ROLES.includes(value as ProcessingRole)
    ? (value as ProcessingRole)
    : null;
}

function unwrapRecord(raw: unknown, key?: string): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  if (key && isRecord(raw[key])) return raw[key] as Record<string, unknown>;
  if (isRecord(raw.data)) {
    const nested = raw.data;
    if (key && isRecord(nested[key])) return nested[key] as Record<string, unknown>;
    return nested;
  }
  if (key && isRecord(raw.user) && key === 'user') return raw.user as Record<string, unknown>;
  return raw;
}

export function toNamedRef(value: unknown): NamedRef | null {
  if (!isRecord(value)) return null;
  const id = asNumber(value.id);
  const name = asString(value.name);
  if (id == null || !name) return null;
  return { id, name };
}

function toNamedRefList(value: unknown): NamedRef[] {
  if (!Array.isArray(value)) return [];
  return value.map(toNamedRef).filter((item): item is NamedRef => item != null);
}

function countFrom(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const count = asNumber(value[key]);
  return count ?? undefined;
}

export function toAdmin(value: unknown): Admin {
  const row = isRecord(value) ? value : {};
  return {
    id: asNumber(row.id) ?? 0,
    userId: asNumber(row.userId) ?? undefined,
    name: asString(row.name) ?? '',
    phone: normalizeContactPhone(asString(row.phone)),
    address: normalizeOptionalText(row.address),
    isSuperAdmin: row.isSuperAdmin === true,
  };
}

export function toClient(value: unknown): Client {
  const row = isRecord(value) ? value : {};
  const count = isRecord(row._count) ? row._count : undefined;
  return {
    id: asNumber(row.id) ?? 0,
    userId: asNumber(row.userId) ?? undefined,
    name: asString(row.name) ?? '',
    phone: normalizeContactPhone(asString(row.phone)),
    address: normalizeOptionalText(row.address),
    districtId: asNumber(row.districtId),
    district: toNamedRef(row.district),
    ordersCount: countFrom(count, 'orders'),
  };
}

export function toEmployee(value: unknown): Employee {
  const row = isRecord(value) ? value : {};
  const count = isRecord(row._count) ? row._count : undefined;
  return {
    id: asNumber(row.id) ?? 0,
    userId: asNumber(row.userId) ?? undefined,
    name: asString(row.name) ?? '',
    position: asString(row.position),
    phone: normalizeContactPhone(asString(row.phone)),
    address: normalizeOptionalText(row.address),
    processingRole: asProcessingRole(row.processingRole),
    warehouseId: asNumber(row.warehouseId),
    warehouse: toNamedRef(row.warehouse),
    warehouses: toNamedRefList(row.warehouses),
    districts: toNamedRefList(row.districts),
    tasksCount: countFrom(count, 'tasks'),
  };
}

export function toSupplier(value: unknown): Supplier {
  const row = isRecord(value) ? value : {};
  const count = isRecord(row._count) ? row._count : undefined;
  return {
    id: asNumber(row.id) ?? 0,
    userId: asNumber(row.userId) ?? undefined,
    companyName: asString(row.companyName) ?? '',
    contactPerson: asString(row.contactPerson) ?? '',
    phone: normalizeContactPhone(asString(row.phone)),
    address: normalizeOptionalText(row.address),
    bankAccount: asString(row.bankAccount),
    bik: asString(row.bik),
    inn: asString(row.inn),
    ogrn: asString(row.ogrn),
    productsCount: countFrom(count, 'products'),
    suppliesCount: countFrom(count, 'supplies'),
  };
}

export function toDriver(value: unknown): Driver {
  const row = isRecord(value) ? value : {};
  const count = isRecord(row._count) ? row._count : undefined;
  return {
    id: asNumber(row.id) ?? 0,
    userId: asNumber(row.userId) ?? undefined,
    name: asString(row.name) ?? '',
    phone: normalizeContactPhone(asString(row.phone)),
    address: normalizeOptionalText(row.address),
    warehouseId: asNumber(row.warehouseId),
    warehouse: toNamedRef(row.warehouse),
    districts: toNamedRefList(row.districts),
    stopsCount: countFrom(count, 'stops'),
  };
}

function profileFromRole(role: UserRole, value: unknown): AdminUserProfile {
  if (value == null) return { kind: 'UNKNOWN' };

  switch (role) {
    case 'ADMIN':
      return { kind: 'ADMIN', data: toAdmin(value) };
    case 'CLIENT':
      return { kind: 'CLIENT', data: toClient(value) };
    case 'EMPLOYEE':
      return { kind: 'EMPLOYEE', data: toEmployee(value) };
    case 'SUPPLIER':
      return { kind: 'SUPPLIER', data: toSupplier(value) };
    case 'DRIVER':
      return { kind: 'DRIVER', data: toDriver(value) };
  }
}

function contactFromProfile(profile: AdminUserProfile): string | null {
  if (profile.kind === 'UNKNOWN') return null;
  return normalizeContactPhone(profile.data.phone);
}

function toListItem(input: {
  userId: number;
  email: string | null;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled?: boolean;
  profileCompletedAt?: string | null;
  profile: AdminUserProfile;
}): AdminUserListItem {
  return {
    userId: input.userId,
    email: input.email,
    role: input.role,
    avatar: input.avatar,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    twoFactorEnabled: input.twoFactorEnabled ?? false,
    profileCompletedAt: input.profileCompletedAt ?? null,
    isSuperAdmin: input.profile.kind === 'ADMIN' && input.profile.data.isSuperAdmin === true,
    displayName: getUserDisplayName({
      role: input.role,
      email: input.email,
      profileCompletedAt: input.profileCompletedAt,
      profile: input.profile,
    }),
    contactPhone: contactFromProfile(input.profile),
    profile: input.profile,
  };
}

function readUserRow(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  if (isRecord(raw.user)) return raw.user as Record<string, unknown>;
  if (isRecord(raw.data) && isRecord(raw.data.user)) return raw.data.user as Record<string, unknown>;
  return unwrapRecord(raw);
}

/** Строка `GET /api/admin/users` → канон списка. */
export function adminUsersRowToItem(raw: unknown): AdminUserListItem | null {
  const row = isRecord(raw) ? raw : {};
  const userId = asNumber(row.id);
  const role = asUserRole(row.role);
  if (userId == null || role == null) return null;

  return toListItem({
    userId,
    email: asString(row.email),
    role,
    avatar: asString(row.avatar),
    createdAt: asString(row.createdAt) ?? '',
    updatedAt: asString(row.updatedAt) ?? '',
    twoFactorEnabled: asBoolean(row.twoFactorEnabled),
    profileCompletedAt: asString(row.profileCompletedAt),
    profile: profileFromRole(role, row.profile),
  });
}

/** Строка `GET /api/admin/staff` → канон списка. */
export function adminStaffRowToItem(raw: unknown): AdminUserListItem | null {
  const row = isRecord(raw) ? raw : {};
  const userId = asNumber(row.id);
  const role = asUserRole(row.role);
  if (userId == null || role == null) return null;

  const nested =
    role === 'EMPLOYEE' ? row.employee
    : role === 'SUPPLIER' ? row.supplier
    : role === 'DRIVER' ? row.driver
    : role === 'ADMIN' ? row.admin
    : row.client;

  return toListItem({
    userId,
    email: asString(row.email),
    role,
    avatar: asString(row.avatar),
    createdAt: asString(row.createdAt) ?? '',
    updatedAt: asString(row.updatedAt) ?? '',
    twoFactorEnabled: asBoolean(row.twoFactorEnabled),
    profileCompletedAt: asString(row.profileCompletedAt),
    profile: profileFromRole(role, nested ?? row.profile),
  });
}

/** `GET /api/users/:id` → карточка. `employeeId`/`driverId` — id профиля, не User.id. */
export function userByIdToDetail(raw: unknown): UserDetail {
  const row = readUserRow(raw);
  const userId = asNumber(row.id) ?? 0;
  const role = asUserRole(row.role) ?? 'CLIENT';
  const nestedKey = role.toLowerCase();
  const profile = profileFromRole(role, row.profile ?? row[nestedKey]);
  const item = toListItem({
    userId,
    email: asString(row.email),
    role,
    avatar: asString(row.avatar),
    createdAt: asString(row.createdAt) ?? '',
    updatedAt: asString(row.updatedAt) ?? '',
    twoFactorEnabled: asBoolean(row.twoFactorEnabled),
    profileCompletedAt: asString(row.profileCompletedAt),
    profile,
  });

  return {
    ...item,
    loginPhone: normalizeContactPhone(asString(row.phone)),
    lastSeenAt: asString(row.lastSeenAt),
    gender: asString(row.gender),
    passwordSet: asBoolean(row.passwordSet),
    emailVerifiedAt: asString(row.emailVerifiedAt),
    phoneVerifiedAt: asString(row.phoneVerifiedAt),
    employeeId: profile.kind === 'EMPLOYEE' ? profile.data.id : null,
    driverId: profile.kind === 'DRIVER' ? profile.data.id : null,
    adminRecordId: profile.kind === 'ADMIN' ? profile.data.id : null,
  };
}

export function createdUserId(raw: unknown, nestedKey: 'admin' | 'staff'): number | null {
  const row = unwrapRecord(raw);
  if (isRecord(row[nestedKey])) {
    return asNumber((row[nestedKey] as Record<string, unknown>).id);
  }
  return asNumber(row.id);
}
