import { z } from 'zod';
import { isPhoneRu } from '@/shared/lib';
import type { UserRole } from '@/entities/user';
import type { CreateAdminPayload, CreateStaffPayload, ChangeRolePayload } from './types';

export const passwordSchema = z.string()
  .min(6, 'Пароль должен содержать минимум 6 символов')
  .regex(/[a-z]/, 'Нужна строчная буква')
  .regex(/[A-Z]/, 'Нужна заглавная буква')
  .regex(/\d/, 'Нужна цифра');

const optionalText = z.string().optional().or(z.literal(''));

const createBase = z.object({
  email: z.string().email('Введите корректный email'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Повторите пароль'),
  phone: optionalText,
  address: optionalText,
});

const createAdminSchema = createBase.extend({
  role: z.literal('ADMIN'),
  name: z.string().trim().min(2, 'Укажите имя'),
});

const createEmployeeSchema = createBase.extend({
  role: z.literal('EMPLOYEE'),
  name: optionalText,
  position: optionalText,
  allWarehouses: z.boolean(),
  warehouseIds: z.array(z.number()),
  districts: z.array(z.number()),
});

const createSupplierSchema = createBase.extend({
  role: z.literal('SUPPLIER'),
  companyName: z.string().trim().min(2, 'Укажите название компании'),
  contactPerson: z.string().trim().min(2, 'Укажите контактное лицо'),
  inn: optionalText,
  ogrn: optionalText,
  bankAccount: optionalText,
  bik: optionalText,
});

const createDriverSchema = createBase.extend({
  role: z.literal('DRIVER'),
  name: z.string().trim().min(2, 'Укажите имя'),
  districts: z.array(z.number()),
});

const createClientSchema = createBase.extend({
  role: z.literal('CLIENT'),
  name: z.string().trim().min(2, 'Укажите имя'),
  districtId: z.number().nullable().optional(),
});

export const createUserFormSchema = z.discriminatedUnion('role', [
  createAdminSchema,
  createEmployeeSchema,
  createSupplierSchema,
  createDriverSchema,
  createClientSchema,
]).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Пароли не совпадают',
    });
  }
  if (data.phone && data.phone.trim() && !isPhoneRu(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'Введите номер в формате +7…',
    });
  }
  if (data.address && data.address.trim() && data.address.trim().length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message: 'Адрес должен содержать минимум 5 символов',
    });
  }
  if (data.role === 'EMPLOYEE') {
    if (data.districts.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['districts'],
        message: 'Выберите хотя бы один район',
      });
    }
    if (!data.allWarehouses && data.warehouseIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warehouseIds'],
        message: 'Выберите склады или отметьте «Все активные склады»',
      });
    }
  }
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export type CreateUserFormState = {
  role: UserRole;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  name: string;
  position: string;
  allWarehouses: boolean;
  warehouseIds: number[];
  districts: number[];
  districtId: number | null;
  companyName: string;
  contactPerson: string;
  inn: string;
  ogrn: string;
  bankAccount: string;
  bik: string;
};

export function emptyCreateValues(role: UserRole): CreateUserFormState {
  return {
    role,
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    name: '',
    position: '',
    allWarehouses: false,
    warehouseIds: [],
    districts: [],
    districtId: null,
    companyName: '',
    contactPerson: '',
    inn: '',
    ogrn: '',
    bankAccount: '',
    bik: '',
  };
}

export function keepCreateCredentials(values: CreateUserFormState): Pick<
  CreateUserFormState,
  'email' | 'password' | 'confirmPassword' | 'phone' | 'address'
> {
  return {
    email: values.email,
    password: values.password,
    confirmPassword: values.confirmPassword,
    phone: values.phone,
    address: values.address,
  };
}

export function valuesToCreatePayload(
  values: CreateUserFormState | CreateUserFormValues,
): CreateAdminPayload | CreateStaffPayload {
  const phone = values.phone?.trim() || undefined;
  const address = values.address?.trim() || undefined;

  if (values.role === 'ADMIN') {
    return {
      email: values.email,
      password: values.password,
      name: values.name,
      phone,
      address,
    };
  }

  const shared = {
    email: values.email,
    password: values.password,
    phone,
    address,
  };

  if (values.role === 'EMPLOYEE') {
    return {
      ...shared,
      role: 'EMPLOYEE',
      name: values.name?.trim() || undefined,
      position: values.position?.trim() || undefined,
      allWarehouses: values.allWarehouses || undefined,
      warehouseIds: values.allWarehouses ? undefined : values.warehouseIds,
      districts: values.districts,
    };
  }

  if (values.role === 'SUPPLIER') {
    return {
      ...shared,
      role: 'SUPPLIER',
      companyName: values.companyName,
      contactPerson: values.contactPerson,
      inn: values.inn,
      ogrn: values.ogrn,
      bankAccount: values.bankAccount,
      bik: values.bik,
    };
  }

  if (values.role === 'DRIVER') {
    return {
      ...shared,
      role: 'DRIVER',
      name: values.name,
      districts: values.districts.length > 0 ? values.districts : undefined,
    };
  }

  return {
    ...shared,
    role: 'CLIENT',
    name: values.name,
    districtId: values.districtId ?? undefined,
  };
}

const changeBase = z.object({
  name: optionalText,
  phone: optionalText,
  address: optionalText,
});

const changeAdminSchema = changeBase.extend({
  newRole: z.literal('ADMIN'),
  isSuperAdmin: z.boolean().optional(),
});

const changeEmployeeSchema = changeBase.extend({
  newRole: z.literal('EMPLOYEE'),
  position: optionalText,
  processingRole: z.enum([
    'PICKER',
    'PACKER',
    'QUALITY_CHECKER',
    'COURIER',
    'SUPERVISOR',
    'MANAGER',
  ]).optional().nullable(),
  allWarehouses: z.boolean(),
  warehouseIds: z.array(z.number()),
  districts: z.array(z.number()),
});

const changeSupplierSchema = changeBase.extend({
  newRole: z.literal('SUPPLIER'),
  companyName: z.string().trim().min(2, 'Укажите название компании'),
  contactPerson: z.string().trim().min(2, 'Укажите контактное лицо'),
  inn: optionalText,
  ogrn: optionalText,
  bankAccount: optionalText,
  bik: optionalText,
});

const changeDriverSchema = changeBase.extend({
  newRole: z.literal('DRIVER'),
  districts: z.array(z.number()),
});

const changeClientSchema = changeBase.extend({
  newRole: z.literal('CLIENT'),
  districtId: z.number().nullable(),
});

export const changeRoleFormSchema = z.discriminatedUnion('newRole', [
  changeAdminSchema,
  changeEmployeeSchema,
  changeSupplierSchema,
  changeDriverSchema,
  changeClientSchema,
]).superRefine((data, ctx) => {
  if (data.phone && data.phone.trim() && !isPhoneRu(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'Введите номер в формате +7…',
    });
  }
  if (data.address && data.address.trim() && data.address.trim().length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message: 'Адрес должен содержать минимум 5 символов',
    });
  }
  if (data.newRole !== 'ADMIN' && 'isSuperAdmin' in data && data.isSuperAdmin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isSuperAdmin'],
      message: 'Суперадмина можно назначить только роли администратора',
    });
  }
  if (data.newRole === 'EMPLOYEE') {
    if (data.districts.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['districts'],
        message: 'Выберите хотя бы один район',
      });
    }
    if (!data.allWarehouses && data.warehouseIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warehouseIds'],
        message: 'Выберите склады или отметьте «Все активные склады»',
      });
    }
  }
  if (data.newRole === 'CLIENT' && data.districtId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['districtId'],
      message: 'Выберите район',
    });
  }
});

export type ChangeRoleFormValues = z.infer<typeof changeRoleFormSchema>;

export type ChangeRoleFormState = {
  newRole: UserRole;
  isSuperAdmin: boolean;
  name: string;
  phone: string;
  address: string;
  position: string;
  processingRole: ChangeRolePayload['processingRole'] | null;
  allWarehouses: boolean;
  warehouseIds: number[];
  districts: number[];
  districtId: number | null;
  companyName: string;
  contactPerson: string;
  inn: string;
  ogrn: string;
  bankAccount: string;
  bik: string;
};

export function emptyChangeRoleValues(newRole: UserRole): ChangeRoleFormState {
  return {
    newRole,
    isSuperAdmin: false,
    name: '',
    phone: '',
    address: '',
    position: '',
    processingRole: null,
    allWarehouses: false,
    warehouseIds: [],
    districts: [],
    districtId: null,
    companyName: '',
    contactPerson: '',
    inn: '',
    ogrn: '',
    bankAccount: '',
    bik: '',
  };
}

export function valuesToChangeRolePayload(values: ChangeRoleFormState): ChangeRolePayload {
  const phone = values.phone.trim() || undefined;
  const address = values.address.trim() || undefined;
  const name = values.name.trim() || undefined;

  if (values.newRole === 'ADMIN') {
    return {
      newRole: 'ADMIN',
      isSuperAdmin: values.isSuperAdmin || undefined,
      name,
      phone,
      address,
    };
  }

  if (values.newRole === 'EMPLOYEE') {
    return {
      newRole: 'EMPLOYEE',
      name,
      phone,
      address,
      position: values.position.trim() || undefined,
      processingRole: values.processingRole ?? undefined,
      allWarehouses: values.allWarehouses || undefined,
      warehouseIds: values.allWarehouses ? undefined : values.warehouseIds,
      districts: values.districts,
    };
  }

  if (values.newRole === 'SUPPLIER') {
    return {
      newRole: 'SUPPLIER',
      phone,
      address,
      companyName: values.companyName,
      contactPerson: values.contactPerson,
      inn: values.inn,
      ogrn: values.ogrn,
      bankAccount: values.bankAccount,
      bik: values.bik,
    };
  }

  if (values.newRole === 'DRIVER') {
    return {
      newRole: 'DRIVER',
      name,
      phone,
      address,
      districts: values.districts,
    };
  }

  return {
    newRole: 'CLIENT',
    name,
    phone,
    address,
    districtId: values.districtId ?? undefined,
  };
}
