import { Card, Form, Input, Button, Typography, Modal, message, Avatar, Space, Tag, Descriptions, Empty, Spin, Tooltip, Grid } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, changePassword, initiateEmailChange, confirmEmailChange, uploadAvatar } from '@/entities/user';
import type { ProfileUpdatePayload, User } from '@/entities/user';
import { ProductCard } from '@/entities/product';
import { getProducts } from '@/entities/product';
import type { Product } from '@/entities/product';
import { getApiMessage } from '@/shared/lib';
import { tokenStorage } from '@/shared/api';

const EMPTY_VALUE = '—';
const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Клиент',
  EMPLOYEE: 'Сотрудник',
  SUPPLIER: 'Поставщик',
  ADMIN: 'Администратор',
  DRIVER: 'Водитель',
};

const PROCESSING_ROLE_LABELS: Record<string, string> = {
  PICKER: 'Сборщик',
  PACKER: 'Упаковщик',
  QUALITY_CHECKER: 'Контроль качества',
  COURIER: 'Курьер',
  SUPERVISOR: 'Супервайзер',
  MANAGER: 'Менеджер',
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Мужской',
  FEMALE: 'Женский',
  OTHER: 'Другой',
  PREFER_NOT_TO_SAY: 'Предпочитаю не указывать',
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function formatProfileValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatDistrictValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_VALUE;
    const names = value
      .map((item) => {
        if (isPlainRecord(item)) {
          const name = item.name;
          if (typeof name === 'string' && name.trim()) return name.trim();
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));

    return names.length > 0 ? names.join(', ') : formatProfileValue(value);
  }

  if (isPlainRecord(value) && typeof value.name === 'string') {
    return value.name;
  }

  return formatProfileValue(value);
}

function formatWarehouseValue(value: unknown): string {
  if (!isPlainRecord(value)) return formatProfileValue(value);

  const district = toRecord(value.district);
  const parts = [
    typeof value.name === 'string' ? value.name : null,
    typeof district.name === 'string' ? district.name : null,
    typeof value.address === 'string' ? value.address : null,
  ].filter((item): item is string => Boolean(item && item.trim()));

  return parts.length > 0 ? parts.join(' • ') : formatProfileValue(value);
}

function formatArrayField(field: string, value: unknown[]): string {
  if (value.length === 0) {
    return EMPTY_VALUE;
  }

  if (field === 'districts') {
    return formatDistrictValue(value);
  }

  if (field === 'tasks') {
    return `Назначено задач: ${value.length}`;
  }

  if (field === 'workTimes') {
    return `Записей о сменах: ${value.length}`;
  }

  if (field === 'warehouses') {
    const formatted = value
      .map((item) => formatWarehouseValue(item))
      .filter((item) => item !== EMPTY_VALUE);
    return formatted.length > 0 ? formatted.join('; ') : EMPTY_VALUE;
  }

  return formatProfileValue(value);
}

function getRoleLabel(role: unknown): string {
  const roleValue = String(role ?? '');
  return ROLE_LABELS[roleValue] ?? (roleValue || EMPTY_VALUE);
}

function formatFieldValue(field: string, value: unknown): string {
  if (field === 'role') return getRoleLabel(value);
  if (field === 'gender') return GENDER_LABELS[String(value ?? '')] ?? formatProfileValue(value);
  if (field === 'processingRole') return PROCESSING_ROLE_LABELS[String(value ?? '')] ?? formatProfileValue(value);
  if (field === 'emailVerified' || field === 'phoneVerified') return value ? 'Да' : 'Нет';
  if (field === 'districts' || field === 'district') return formatDistrictValue(value);
  if (field === 'warehouse') return formatWarehouseValue(value);
  if (Array.isArray(value)) return formatArrayField(field, value);
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (
    typeof value === 'string' &&
    (/(At|Date|Deadline)$/i.test(field) || /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
  ) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return formatProfileValue(value);
}

function humanizeFieldName(field: string): string {
  const labels: Record<string, string> = {
    id: 'ID',
    userId: 'ID пользователя',
    email: 'Email',
    phone: 'Телефон',
    role: 'Роль пользователя',
    emailVerified: 'Email подтвержден',
    phoneVerified: 'Телефон подтвержден',
    name: 'Имя',
    gender: 'Пол',
    address: 'Адрес',
    companyName: 'Название компании',
    contactPerson: 'Контактное лицо',
    inn: 'ИНН',
    ogrn: 'ОГРН',
    bankAccount: 'Расчетный счет',
    bik: 'БИК',
    position: 'Должность',
    isSuperAdmin: 'Суперадминистратор',
    createdAt: 'Создан',
    updatedAt: 'Обновлен',
    warehouseId: 'Склад',
    warehouse: 'Склад',
    districts: 'Районы',
    district: 'Район',
    processingRole: 'Роль обработки',
    products: 'Товары',
    supplies: 'Поставки',
    tasks: 'Задачи',
    workTimes: 'Рабочие смены',
    emailVerifiedAt: 'Email подтвержден',
    phoneVerifiedAt: 'Телефон подтвержден',
    lastSeenAt: 'Последняя активность',
    lastLoginAt: 'Последний вход',
    passwordSet: 'Пароль установлен',
    twoFactorEnabled: 'Двухфакторная аутентификация',
    twoFactorSecret: 'Секрет 2FA',
    isActive: 'Активен',
    isVerified: 'Подтвержден',
    moderationStatus: 'Статус модерации',
    supplierProposedPrice: 'Предложенная цена поставщика',
    supplierProposedBoxPrice: 'Предложенная цена за коробку',
    moderationReason: 'Причина модерации',
    moderatedAt: 'Модерировано',
    feedbackCount: 'Количество отзывов',
    averageRating: 'Средний рейтинг',
    stockQuantity: 'Остаток',
    boxPrice: 'Цена за коробку',
    wholesalePrice: 'Оптовая цена',
    wholesaleMinQty: 'Минимум для опта',
    itemsPerBox: 'Единиц в коробке',
    lowStockThreshold: 'Порог низкого остатка',
    status: 'Статус',
  };

  if (labels[field]) return labels[field];
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getRoleProfile(user: User): Record<string, unknown> {
  const u = toRecord(user);
  const roleKey = user.role.toLowerCase();
  const lowerProfile = toRecord(u[roleKey]);
  const upperProfile = toRecord(u[roleKey.charAt(0).toUpperCase() + roleKey.slice(1)]);
  return Object.keys(lowerProfile).length > 0 ? lowerProfile : upperProfile;
}

function getUserDisplayName(user: User): string {
  const roleProfile = getRoleProfile(user);
  const name =
    roleProfile.name ??
    roleProfile.contactPerson ??
    roleProfile.companyName ??
    toRecord(user).name ??
    user.email ??
    user.phone;
  return String(name ?? 'Пользователь');
}

function buildFields(record: Record<string, unknown>, hidden: string[] = []): Array<[string, unknown]> {
  return Object.entries(record)
    .filter(([key]) => !hidden.includes(key))
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
}


function PasswordModal({
  open,
  onCancel,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: PasswordFormValues) => void;
  isLoading: boolean;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onOk = handleSubmit((values) => {
    onSubmit(values);
    reset();
  });

  return (
    <Modal
      title="Сменить пароль"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Отмена</Button>,
        <Button key="submit" type="primary" loading={isLoading} onClick={onOk}>Сменить пароль</Button>,
      ]}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Текущий пароль" validateStatus={errors.currentPassword ? 'error' : undefined} help={errors.currentPassword?.message}>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field }) => (
              <Input.Password
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="Текущий пароль"
                autoComplete="current-password"
              />
            )}
          />
        </Form.Item>
        <Form.Item label="Новый пароль" validateStatus={errors.newPassword ? 'error' : undefined} help={errors.newPassword?.message}>
          <Controller
            control={control}
            name="newPassword"
            render={({ field }) => (
              <Input.Password
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="Новый пароль"
                autoComplete="new-password"
              />
            )}
          />
        </Form.Item>
        <Form.Item label="Подтверждение" validateStatus={errors.confirmPassword ? 'error' : undefined} help={errors.confirmPassword?.message}>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <Input.Password
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="Повторите новый пароль"
                autoComplete="new-password"
              />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

const supplierSchema = z.object({
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  companyName: z.string().min(1, 'Укажите название компании'),
  contactPerson: z.string().min(1, 'Укажите контактное лицо'),
  phone: z.string().optional(),
  address: z.string().optional(),
  inn: z.string().optional(),
  ogrn: z.string().optional(),
  bankAccount: z.string().optional(),
  bik: z.string().optional(),
});

const employeeAdminSchema = z.object({
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  name: z.string().min(1, 'Укажите имя'),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'Пароли не совпадают', path: ['confirmPassword'] });

const emailChangeSchema = z.object({
  email: z.string().email('Некорректный email'),
  verificationCode: z.string().min(6, 'Введите 6-значный код').max(6, 'Введите 6-значный код'),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;
type EmployeeAdminFormValues = z.infer<typeof employeeAdminSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;
type EmailChangeFormValues = z.infer<typeof emailChangeSchema>;

type ValidationErrorItem = {
  msg?: string;
  path?: string;
  param?: string;
  field?: string;
};

type ServerFieldErrors = Partial<Record<
  | keyof SupplierFormValues
  | keyof EmployeeAdminFormValues,
  string
>>;

function extractValidationErrors(error: unknown): ValidationErrorItem[] {
  const responseData = (error as { response?: { data?: { errors?: unknown } } })?.response?.data;
  if (!responseData || !Array.isArray(responseData.errors)) {
    return [];
  }
  return responseData.errors as ValidationErrorItem[];
}

function normalizeValidationPath(path?: string): string {
  if (!path) return '';
  const normalized = path.trim().replace(/\[(\d+)\]/g, '.$1');
  const segments = normalized.split('.').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : normalized;
}

function resolveFieldNameFromValidation(
  item: ValidationErrorItem,
): string {
  const rawPath = normalizeValidationPath(item.path ?? item.param ?? item.field);
  const pathAliases: Record<string, string> = {
    bank_account: 'bankAccount',
    bankaccount: 'bankAccount',
    accountnumber: 'bankAccount',
    bik_code: 'bik',
    company_name: 'companyName',
    contact_person: 'contactPerson',
    full_name: 'name',
    phone_number: 'phone',
  };

  const normalizedPath = rawPath ? rawPath.replace(/[\s_-]/g, '').toLowerCase() : '';
  if (normalizedPath && pathAliases[normalizedPath]) {
    return pathAliases[normalizedPath];
  }
  if (rawPath) return rawPath;

  const msg = (item.msg ?? '').toLowerCase();
  if (msg.includes('огрн')) return 'ogrn';
  if (msg.includes('инн')) return 'inn';
  if (msg.includes('бик')) return 'bik';
  if (msg.includes('расчетного счета') || msg.includes('расчётного счета') || msg.includes('банковск')) return 'bankAccount';
  if (msg.includes('контакт') && msg.includes('лиц')) return 'contactPerson';
  if (msg.includes('названи') && msg.includes('компан')) return 'companyName';
  if (msg.includes('email') || msg.includes('почт')) return 'email';
  if (msg.includes('телефон')) return 'phone';
  if (msg.includes('адрес')) return 'address';
  if (msg.includes('должност')) return 'position';
  if (msg.includes('имя')) return 'name';

  return '';
}

function EmailChangeModal({
  open,
  onCancel,
  onSendCode,
  onConfirm,
  hasBindToken,
  isSending,
  isConfirming,
}: {
  open: boolean;
  onCancel: () => void;
  onSendCode: (email: string) => void;
  onConfirm: (email: string, verificationCode: string) => void;
  hasBindToken: boolean;
  isSending: boolean;
  isConfirming: boolean;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<EmailChangeFormValues>({
    resolver: zodResolver(emailChangeSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { email: '', verificationCode: '' },
  });

  useEffect(() => {
    if (!open) {
      reset({ email: '', verificationCode: '' });
    }
  }, [open, reset]);

  const handleSendCode = () => {
    const email = watch('email');
    if (!email || !z.string().email().safeParse(email).success) {
      message.error('Введите корректный email');
      return;
    }
    onSendCode(email);
  };

  const submit = handleSubmit((values) => {
    onConfirm(values.email, values.verificationCode);
  });

  return (
    <Modal
      title="Смена email"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Отмена</Button>,
        <Button
          key="send"
          onClick={handleSendCode}
          loading={isSending}
          disabled={isConfirming}
        >
          Отправить код
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={submit}
          loading={isConfirming}
          disabled={!hasBindToken}
        >
          Подтвердить email
        </Button>,
      ]}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="Новый email"
          validateStatus={errors.email ? 'error' : undefined}
          help={errors.email?.message}
        >
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                type="email"
                placeholder="example@почта.ру"
                autoComplete="email"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Код подтверждения"
          validateStatus={errors.verificationCode ? 'error' : undefined}
          help={errors.verificationCode?.message || 'Код придет на указанный email'}
        >
          <Controller
            control={control}
            name="verificationCode"
            render={({ field }) => (
              <Input
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="123456"
                maxLength={6}
                autoComplete="one-time-code"
              />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function getInitialSupplierValues(user: User): SupplierFormValues {
  const u = user as unknown as Record<string, unknown>;
  const sup = (u.supplier ?? u.Supplier) as Record<string, unknown> | undefined;
  return {
    email: String(u.email ?? user.email ?? ''),
    companyName: String(sup?.companyName ?? u.companyName ?? ''),
    contactPerson: String(sup?.contactPerson ?? u.contactPerson ?? ''),
    phone: String(sup?.phone ?? u.phone ?? ''),
    address: String(sup?.address ?? u.address ?? ''),
    inn: String(sup?.inn ?? u.inn ?? ''),
    ogrn: String(sup?.ogrn ?? u.ogrn ?? ''),
    bankAccount: String(sup?.bankAccount ?? u.bankAccount ?? ''),
    bik: String(sup?.bik ?? u.bik ?? ''),
  };
}

function getInitialEmployeeAdminValues(user: User): EmployeeAdminFormValues {
  const u = user as unknown as Record<string, unknown>;
  const roleKey = user.role.toLowerCase();
  const profile = (
    u[roleKey] ??
    u[roleKey.charAt(0).toUpperCase() + roleKey.slice(1)] ??
    u.employee ??
    u.Employee ??
    u.admin ??
    u.Admin ??
    u.client ??
    u.Client ??
    u.driver ??
    u.Driver
  ) as Record<string, unknown> | undefined;
  return {
    email: String(u.email ?? ''),
    name: String(profile?.name ?? u.name ?? ''),
    phone: String(profile?.phone ?? u.phone ?? ''),
    address: String(profile?.address ?? u.address ?? ''),
    position: String(profile?.position ?? u.position ?? ''),
  };
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const isTablet = Boolean(screens.sm && !screens.lg);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingBindToken, setPendingBindToken] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<ServerFieldErrors>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isSupplier = user?.role === 'SUPPLIER';

  const { data: supplierProductsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ page: 1, limit: 100 }),
    enabled: isSupplier,
  });

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      email: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      address: '',
      inn: '',
      ogrn: '',
      bankAccount: '',
      bik: '',
    },
  });

  const employeeAdminForm = useForm<EmployeeAdminFormValues>({
    resolver: zodResolver(employeeAdminSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
      address: '',
      position: '',
    },
  });

  const applyServerValidationErrors = (error: unknown) => {
    const validationErrors = extractValidationErrors(error);
    if (validationErrors.length === 0) {
      setServerFieldErrors({});
      return false;
    }

    const supplierFields = new Set<keyof SupplierFormValues>([
      'email',
      'companyName',
      'contactPerson',
      'phone',
      'address',
      'inn',
      'ogrn',
      'bankAccount',
      'bik',
    ]);
    const commonFields = new Set<keyof EmployeeAdminFormValues>([
      'email',
      'name',
      'phone',
      'address',
      'position',
    ]);

    let appliedCount = 0;
    const nextServerFieldErrors: ServerFieldErrors = {};

    for (const errorItem of validationErrors) {
      const fieldName = resolveFieldNameFromValidation(errorItem);
      const errorMessage = errorItem.msg ?? 'Некорректное значение';
      if (!fieldName) continue;

      if (isSupplier && supplierFields.has(fieldName as keyof SupplierFormValues)) {
        nextServerFieldErrors[fieldName as keyof SupplierFormValues] = errorMessage;
        supplierForm.setError(fieldName as keyof SupplierFormValues, {
          type: 'server',
          message: errorMessage,
        });
        appliedCount += 1;
        continue;
      }

      if (!isSupplier && commonFields.has(fieldName as keyof EmployeeAdminFormValues)) {
        nextServerFieldErrors[fieldName as keyof EmployeeAdminFormValues] = errorMessage;
        employeeAdminForm.setError(fieldName as keyof EmployeeAdminFormValues, {
          type: 'server',
          message: errorMessage,
        });
        appliedCount += 1;
      }
    }

    setServerFieldErrors(nextServerFieldErrors);

    if (appliedCount > 0) {
      message.error('Проверьте заполнение полей формы');
      return true;
    }

    message.error('Проверьте заполнение полей формы');
    return false;
  };

  const updateMutation = useMutation({
    mutationFn: (data: ProfileUpdatePayload) => updateProfile(data),
    onSuccess: () => {
      setServerFieldErrors({});
      message.success('Профиль обновлён');
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      supplierForm.clearErrors();
      employeeAdminForm.clearErrors();
      const hasAppliedValidation = applyServerValidationErrors(err);
      if (!hasAppliedValidation) {
        message.error(getApiMessage(err));
      }
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordFormValues) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => {
      message.success('Пароль изменён. Войдите снова.');
      tokenStorage.clear();
      setPasswordModalOpen(false);
      navigate('/login', { replace: true });
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const initiateEmailMutation = useMutation({
    mutationFn: (email: string) => initiateEmailChange(email),
    onSuccess: ({ bindToken }) => {
      setPendingBindToken(bindToken);
      message.success('Код подтверждения отправлен на новый email');
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const confirmEmailMutation = useMutation({
    mutationFn: ({ bindToken, verificationCode }: { bindToken: string; verificationCode: string }) =>
      confirmEmailChange(bindToken, verificationCode),
    onSuccess: () => {
      message.success('Email успешно изменен');
      setPendingBindToken(null);
      setEmailModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      message.success('Аватар обновлён');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('Выберите изображение');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Максимальный размер файла — 5 МБ');
      return;
    }
    avatarMutation.mutate(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (!user || !isEditMode) return;
    setServerFieldErrors({});
    if (user.role === 'SUPPLIER') {
      supplierForm.reset(getInitialSupplierValues(user));
      return;
    }
    employeeAdminForm.reset(getInitialEmployeeAdminValues(user));
  }, [isEditMode, user, supplierForm, employeeAdminForm]);

  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  if (isLoading) {
    return <Card loading />;
  }

  if (isError || !user) {
    return (
      <Card>
        <Typography.Text type="danger">Не удалось загрузить профиль</Typography.Text>
      </Card>
    );
  }

  const handleSupplierSubmit = (data: SupplierFormValues) => {
    setServerFieldErrors({});
    const payloadEmail = user.emailVerifiedAt ? undefined : (data.email || undefined);
    updateMutation.mutate({
      email: payloadEmail,
      companyName: data.companyName.trim(),
      contactPerson: data.contactPerson.trim(),
      phone: data.phone || null,
      address: data.address || null,
      inn: data.inn || null,
      ogrn: data.ogrn || null,
      bankAccount: data.bankAccount || null,
      bik: data.bik || null,
    });
  };

  const handleEmployeeAdminSubmit = (data: EmployeeAdminFormValues) => {
    setServerFieldErrors({});
    const payloadEmail = user.emailVerifiedAt ? undefined : (data.email || undefined);
    updateMutation.mutate({
      email: payloadEmail,
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      position: data.position || null,
    });
  };

  const handleSendEmailCode = (email: string) => {
    initiateEmailMutation.mutate(email);
  };

  const handleConfirmEmailCode = (_email: string, verificationCode: string) => {
    if (!pendingBindToken) {
      message.error('Сначала отправьте код подтверждения');
      return;
    }
    confirmEmailMutation.mutate({ bindToken: pendingBindToken, verificationCode });
  };

  const supplierInitialValues = getInitialSupplierValues(user);
  const commonInitialValues = getInitialEmployeeAdminValues(user);
  const isSupplierInitialEmpty = Object.values(supplierInitialValues).every((value) => String(value ?? '').trim() === '');
  const isCommonInitialEmpty = Object.values(commonInitialValues).every((value) => String(value ?? '').trim() === '');
  const shouldShowAutofillError = isSupplier ? isSupplierInitialEmpty : isCommonInitialEmpty;

  const userRecord = toRecord(user);
  const roleProfile = getRoleProfile(user);
  const userName = getUserDisplayName(user);
  const products: Product[] = isSupplier
    ? (supplierProductsData?.data ?? [])
    : [];

  const baseFields = buildFields(
    {
      id: userRecord.id,
      role: userRecord.role,
      email: userRecord.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      phone: userRecord.phone,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      gender: userRecord.gender,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
    },
    [],
  );

  const roleFieldHiddenKeys = ['id', 'userId', 'products'];
  if (roleProfile.warehouse && roleProfile.warehouseId) {
    roleFieldHiddenKeys.push('warehouseId');
  }

  const roleFields = buildFields(roleProfile, roleFieldHiddenKeys);

  const hiddenTopLevelKeys = [
    'id',
    'role',
    'email',
    'phone',
    'gender',
    'createdAt',
    'updatedAt',
    'emailVerifiedAt',
    'phoneVerifiedAt',
    'supplier',
    'employee',
    'admin',
    'driver',
    'client',
    'Supplier',
    'Employee',
    'Admin',
    'Driver',
    'Client',
  ];
  const additionalFields = buildFields(userRecord, hiddenTopLevelKeys);

  return (
    <div style={{ display: 'grid', gap: isMobile ? 12 : 16 }}>
      <Typography.Title level={isMobile ? 5 : 4} style={{ marginBottom: 0 }}>Профиль</Typography.Title>

      <Card variant="borderless" style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 12 : 16,
            flexWrap: 'wrap',
          }}
        >
          <Space size={isMobile ? 12 : 16} style={{ width: isMobile ? '100%' : undefined }}>
            <Tooltip title={isEditMode ? 'Загрузить аватар' : (user.avatar ? 'Просмотреть аватар' : undefined)}>
              <div
                style={{ position: 'relative', display: 'inline-block', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => {
                  if (isEditMode) {
                    avatarInputRef.current?.click();
                  } else if (user.avatar) {
                    setAvatarPreviewOpen(true);
                  }
                }}
                onMouseEnter={() => setIsAvatarHovered(true)}
                onMouseLeave={() => setIsAvatarHovered(false)}
              >
                <Spin spinning={avatarMutation.isPending} size="small">
                  <Avatar size={64} src={user.avatar ?? undefined} style={{ display: 'block' }}>
                    {userName.slice(0, 1).toUpperCase()}
                  </Avatar>
                </Spin>
                {isEditMode && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isAvatarHovered ? 1 : 0,
                      transition: 'opacity 0.2s',
                      pointerEvents: 'none',
                    }}
                  >
                    <CameraOutlined style={{ color: '#fff', fontSize: 20 }} />
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
            </Tooltip>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0, wordBreak: 'break-word' }}>{userName}</Typography.Title>
              <Space size={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <Tag color="blue">{getRoleLabel(user.role)}</Tag>
                {user.email && (
                  <Typography.Text type="secondary" style={{ wordBreak: 'break-all' }}>
                    {user.email}
                  </Typography.Text>
                )}
              </Space>
            </div>
          </Space>

          <Space
            wrap
            direction={isMobile ? 'vertical' : 'horizontal'}
            style={{ width: isMobile ? '100%' : undefined }}
          >
            {!isEditMode ? (
              <Button type="primary" block={isMobile} onClick={() => setIsEditMode(true)}>
                Редактировать данные
              </Button>
            ) : (
              <Button
                block={isMobile}
                onClick={() => {
                  setIsEditMode(false);
                  setPendingBindToken(null);
                }}
              >
                Отмена
              </Button>
            )}
            <Button block={isMobile} onClick={() => setPasswordModalOpen(true)}>
              Сменить пароль
            </Button>
          </Space>
        </div>
      </Card>

      {!isEditMode ? (
        <>
          <Card title="Основные данные" variant="borderless" style={{ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)' }}>
            <Descriptions column={1} size="small">
              {baseFields.map(([key, value]) => (
                <Descriptions.Item key={key} label={humanizeFieldName(key)}>
                  <Typography.Text>{formatFieldValue(key, value)}</Typography.Text>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>

          <Card title={`Данные роли (${getRoleLabel(user.role)})`} variant="borderless" style={{ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)' }}>
            {roleFields.length > 0 ? (
              <Descriptions column={1} size="small">
                {roleFields.map(([key, value]) => (
                  <Descriptions.Item key={key} label={humanizeFieldName(key)}>
                    <Typography.Text>{formatFieldValue(key, value)}</Typography.Text>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Typography.Text type="secondary">Дополнительные поля роли отсутствуют.</Typography.Text>
            )}
          </Card>

          {additionalFields.length > 0 && (
            <Card title="Дополнительные данные" variant="borderless" style={{ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)' }}>
              <Descriptions column={1} size="small">
                {additionalFields.map(([key, value]) => (
                  <Descriptions.Item key={key} label={humanizeFieldName(key)}>
                    <Typography.Text>{formatFieldValue(key, value)}</Typography.Text>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}

          {isSupplier && (
            <Card title="Товары пользователя" variant="borderless" style={{ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)' }}>
              {productsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <Spin />
                </div>
              ) : products.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 160 : isTablet ? 220 : 260}px, 1fr))`,
                    gap: isMobile ? 12 : 16,
                  }}
                >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewerRole={user.role}
                      onClick={(p) => navigate(`/products/${p.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <Empty description="У пользователя пока нет товаров" />
              )}
            </Card>
          )}
        </>
      ) : (
        <Card title="Редактирование профиля" variant="borderless" style={{ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)' }}>
          {isSupplier ? (
            <Form
              key={`supplier-edit-${user.id}-${String(userRecord.updatedAt ?? '')}`}
              layout="vertical"
              onFinish={supplierForm.handleSubmit(handleSupplierSubmit)}
            >
              <Form.Item
                label="Email"
                validateStatus={supplierForm.formState.errors.email || serverFieldErrors.email ? 'error' : undefined}
                help={supplierForm.formState.errors.email?.message ?? serverFieldErrors.email}
              >
                <Controller
                  control={supplierForm.control}
                  name="email"
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type="email"
                      placeholder="example@почта.ру"
                      autoComplete="email"
                      disabled={Boolean(user.emailVerifiedAt)}
                    />
                  )}
                />
              </Form.Item>
              {shouldShowAutofillError && (
                <Form.Item>
                  <Typography.Text type="danger">
                    Ошибка автозаполнения: `Cannot read properties of null (reading "includes")`. Данные профиля не удалось подставить автоматически.
                  </Typography.Text>
                </Form.Item>
              )}
              {user.emailVerifiedAt && (
                <Form.Item>
                  <Space direction="vertical" size={8}>
                    <Typography.Text type="secondary">
                      Email подтвержден. Для смены используйте подтверждение через код из письма.
                    </Typography.Text>
                    <Button onClick={() => setEmailModalOpen(true)}>
                      Изменить email
                    </Button>
                  </Space>
                </Form.Item>
              )}
              <Form.Item
                label="Название компании"
                validateStatus={supplierForm.formState.errors.companyName || serverFieldErrors.companyName ? 'error' : undefined}
                help={supplierForm.formState.errors.companyName?.message ?? serverFieldErrors.companyName}
              >
                <Controller
                  control={supplierForm.control}
                  name="companyName"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="ООО «Компания»" />}
                />
              </Form.Item>
              <Form.Item
                label="Контактное лицо"
                validateStatus={supplierForm.formState.errors.contactPerson || serverFieldErrors.contactPerson ? 'error' : undefined}
                help={supplierForm.formState.errors.contactPerson?.message ?? serverFieldErrors.contactPerson}
              >
                <Controller
                  control={supplierForm.control}
                  name="contactPerson"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="name" placeholder="Иван Иванов" />}
                />
              </Form.Item>
              <Form.Item
                label="Телефон"
                validateStatus={supplierForm.formState.errors.phone || serverFieldErrors.phone ? 'error' : undefined}
                help={supplierForm.formState.errors.phone?.message ?? serverFieldErrors.phone}
              >
                <Controller
                  control={supplierForm.control}
                  name="phone"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="tel" placeholder="+7 (999) 123-45-67" />}
                />
              </Form.Item>
              <Form.Item label="Адрес">
                <Controller
                  control={supplierForm.control}
                  name="address"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="street-address" placeholder="Адрес" />}
                />
              </Form.Item>
              <Form.Item
                label="ИНН"
                validateStatus={serverFieldErrors.inn ? 'error' : undefined}
                help={serverFieldErrors.inn}
              >
                <Controller
                  control={supplierForm.control}
                  name="inn"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="ИНН" />}
                />
              </Form.Item>
              <Form.Item
                label="ОГРН"
                validateStatus={serverFieldErrors.ogrn ? 'error' : undefined}
                help={serverFieldErrors.ogrn}
              >
                <Controller
                  control={supplierForm.control}
                  name="ogrn"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="ОГРН" />}
                />
              </Form.Item>
              <Form.Item
                label="Расчётный счёт"
                validateStatus={serverFieldErrors.bankAccount ? 'error' : undefined}
                help={serverFieldErrors.bankAccount}
              >
                <Controller
                  control={supplierForm.control}
                  name="bankAccount"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="Банковский счёт" />}
                />
              </Form.Item>
              <Form.Item
                label="БИК"
                validateStatus={serverFieldErrors.bik ? 'error' : undefined}
                help={serverFieldErrors.bik}
              >
                <Controller
                  control={supplierForm.control}
                  name="bik"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="БИК" />}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
                  <Button type="primary" htmlType="submit" loading={updateMutation.isPending} block={isMobile}>
                    Сохранить
                  </Button>
                  <Button block={isMobile} onClick={() => setIsEditMode(false)}>
                    Отмена
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          ) : (
            <Form
              key={`common-edit-${user.id}-${String(userRecord.updatedAt ?? '')}`}
              layout="vertical"
              onFinish={employeeAdminForm.handleSubmit(handleEmployeeAdminSubmit)}
            >
              <Form.Item
                label="Email"
                validateStatus={employeeAdminForm.formState.errors.email || serverFieldErrors.email ? 'error' : undefined}
                help={employeeAdminForm.formState.errors.email?.message ?? serverFieldErrors.email}
              >
                <Controller
                  control={employeeAdminForm.control}
                  name="email"
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type="email"
                      placeholder="example@почта.ру"
                      autoComplete="email"
                      disabled={Boolean(user.emailVerifiedAt)}
                    />
                  )}
                />
              </Form.Item>
              {shouldShowAutofillError && (
                <Form.Item>
                  <Typography.Text type="danger">
                    Ошибка автозаполнения: `Cannot read properties of null (reading "includes")`. Данные профиля не удалось подставить автоматически.
                  </Typography.Text>
                </Form.Item>
              )}
              {user.emailVerifiedAt && (
                <Form.Item>
                  <Space direction="vertical" size={8}>
                    <Typography.Text type="secondary">
                      Email подтвержден. Для смены используйте подтверждение через код из письма.
                    </Typography.Text>
                    <Button onClick={() => setEmailModalOpen(true)}>
                      Изменить email
                    </Button>
                  </Space>
                </Form.Item>
              )}
              <Form.Item
                label="Имя"
                validateStatus={employeeAdminForm.formState.errors.name || serverFieldErrors.name ? 'error' : undefined}
                help={employeeAdminForm.formState.errors.name?.message ?? serverFieldErrors.name}
              >
                <Controller
                  control={employeeAdminForm.control}
                  name="name"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="name" placeholder="Иван Иванов" />}
                />
              </Form.Item>
              <Form.Item
                label="Телефон"
                validateStatus={employeeAdminForm.formState.errors.phone || serverFieldErrors.phone ? 'error' : undefined}
                help={employeeAdminForm.formState.errors.phone?.message ?? serverFieldErrors.phone}
              >
                <Controller
                  control={employeeAdminForm.control}
                  name="phone"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="tel" placeholder="+7 (999) 123-45-67" />}
                />
              </Form.Item>
              {user.role === 'EMPLOYEE' && (
                <Form.Item
                  label="Должность"
                  validateStatus={serverFieldErrors.position ? 'error' : undefined}
                  help={serverFieldErrors.position}
                >
                  <Controller
                    control={employeeAdminForm.control}
                    name="position"
                    render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="Должность" />}
                  />
                </Form.Item>
              )}
              <Form.Item label="Адрес">
                <Controller
                  control={employeeAdminForm.control}
                  name="address"
                  render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="street-address" placeholder="Адрес" />}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
                  <Button type="primary" htmlType="submit" loading={updateMutation.isPending} block={isMobile}>
                    Сохранить
                  </Button>
                  <Button block={isMobile} onClick={() => setIsEditMode(false)}>
                    Отмена
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Card>
      )}

      <PasswordModal
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        onSubmit={(values) => passwordMutation.mutate(values)}
        isLoading={passwordMutation.isPending}
      />
      <EmailChangeModal
        open={emailModalOpen}
        onCancel={() => {
          setEmailModalOpen(false);
          setPendingBindToken(null);
        }}
        onSendCode={handleSendEmailCode}
        onConfirm={handleConfirmEmailCode}
        hasBindToken={Boolean(pendingBindToken)}
        isSending={initiateEmailMutation.isPending}
        isConfirming={confirmEmailMutation.isPending}
      />
      <Modal
        open={avatarPreviewOpen}
        onCancel={() => setAvatarPreviewOpen(false)}
        footer={null}
        centered
        styles={{ body: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? 8 : 0 } }}
        width={isMobile ? '95vw' : 'auto'}
      >
        <img
          src={user.avatar ?? undefined}
          alt="Аватар"
          style={{ maxWidth: isMobile ? '92vw' : '80vw', maxHeight: '80vh', borderRadius: 8, display: 'block' }}
        />
      </Modal>
    </div>
  );
}
