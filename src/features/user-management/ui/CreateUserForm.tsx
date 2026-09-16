import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Grid,
  Input,
  Select,
  Space,
  message,
} from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { getProfile, USER_ROLE_LABELS, type UserRole } from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import { createAdmin, createStaff } from '../api/admin-users-api';
import { ApiRequestError } from '../api/request';
import type { CreateAdminPayload, CreateStaffPayload } from '../model/types';
import { getDistrictsForSelection, getWarehousesForSelection } from '../api/selection-api';
import { generatePassword } from '../model/password';
import { userManagementKeys } from '../model/query-keys';
import {
  createUserFormSchema,
  emptyCreateValues,
  keepCreateCredentials,
  valuesToCreatePayload,
  type CreateUserFormState,
} from '../model/schemas';

const CREATE_FIELD_NAMES = new Set<string>([
  'email',
  'password',
  'confirmPassword',
  'phone',
  'address',
  'name',
  'position',
  'warehouseIds',
  'districts',
  'districtId',
  'companyName',
  'contactPerson',
  'inn',
  'ogrn',
  'bankAccount',
  'bik',
  'role',
]);

const ALL_ROLES: UserRole[] = ['EMPLOYEE', 'DRIVER', 'SUPPLIER', 'CLIENT', 'ADMIN'];

function resolveInitialRole(requested: string | null, isSuperAdmin: boolean): UserRole {
  const role = ALL_ROLES.find((item) => item === requested);
  if (!role) return 'EMPLOYEE';
  if (role === 'ADMIN' && !isSuperAdmin) return 'EMPLOYEE';
  return role;
}

export function CreateUserForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const initialized = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isSuperAdmin = profile?.admin?.isSuperAdmin === true;
  const roleOptions = useMemo(
    () => (isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((role) => role !== 'ADMIN')),
    [isSuperAdmin],
  );

  const form = useForm<CreateUserFormState>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: emptyCreateValues('EMPLOYEE'),
  });

  const role = form.watch('role');
  const allWarehouses = form.watch('allWarehouses');

  useEffect(() => {
    if (!profile || initialized.current) return;
    initialized.current = true;
    const nextRole = resolveInitialRole(params.get('role'), profile.admin?.isSuperAdmin === true);
    form.reset({
      ...emptyCreateValues(nextRole),
      ...keepCreateCredentials(form.getValues()),
      role: nextRole,
    });
  }, [profile, params, form]);

  const warehousesQuery = useQuery({
    queryKey: userManagementKeys.warehouseSelection(),
    queryFn: () => getWarehousesForSelection(),
    staleTime: 5 * 60_000,
  });

  const districtsQuery = useQuery({
    queryKey: userManagementKeys.districtSelection(),
    queryFn: getDistrictsForSelection,
    staleTime: 5 * 60_000,
  });

  const warehouseOptions = (warehousesQuery.data ?? [])
    .filter((item) => item.isActive !== false)
    .map((item) => ({ label: item.name, value: item.id }));

  const districtOptions = (districtsQuery.data ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserFormState) => {
      const payload = valuesToCreatePayload(values);
      if (values.role === 'ADMIN') {
        return createAdmin(payload as CreateAdminPayload);
      }
      return createStaff(payload as CreateStaffPayload);
    },
    onSuccess: async (result) => {
      message.success(result.message);
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.all });
      navigate(`/users/${result.userId}`);
    },
    onError: (error) => {
      let applied = false;
      if (error instanceof ApiRequestError) {
        error.fieldErrors.forEach(({ path, message: fieldMessage }) => {
          if (CREATE_FIELD_NAMES.has(path)) {
            form.setError(path as keyof CreateUserFormState, { type: 'server', message: fieldMessage });
            applied = true;
          }
        });
      }
      if (!applied) {
        message.error(getApiMessage(error));
      }
    },
  });

  const handleRoleChange = (nextRole: UserRole) => {
    form.reset({
      ...emptyCreateValues(nextRole),
      ...keepCreateCredentials(form.getValues()),
      role: nextRole,
    });
  };

  const handleGeneratePassword = async () => {
    const password = generatePassword();
    form.setValue('password', password, { shouldValidate: true, shouldDirty: true });
    form.setValue('confirmPassword', password, { shouldValidate: true, shouldDirty: true });
    try {
      await navigator.clipboard.writeText(password);
      message.success('Пароль сгенерирован и скопирован');
    } catch {
      message.success('Пароль сгенерирован');
    }
  };

  const handleCopyPassword = async () => {
    const password = form.getValues('password');
    if (!password) {
      message.warning('Сначала введите или сгенерируйте пароль');
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      message.success('Пароль скопирован');
    } catch {
      message.error('Не удалось скопировать пароль');
    }
  };

  const errors = form.formState.errors;

  return (
    <Card>
      <Form
        layout="vertical"
        onFinish={form.handleSubmit((values) => createMutation.mutate(values))}
        style={{ maxWidth: isMobile ? '100%' : 640 }}
      >
        <Form.Item
          label="Роль"
          required
          validateStatus={errors.role ? 'error' : undefined}
          help={errors.role?.message}
        >
          <Controller
            name="role"
            control={form.control}
            render={({ field }) => (
              <Select
                {...field}
                options={roleOptions.map((item) => ({
                  label: USER_ROLE_LABELS[item],
                  value: item,
                }))}
                onChange={(value: UserRole) => handleRoleChange(value)}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Email"
          required
          validateStatus={errors.email ? 'error' : undefined}
          help={errors.email?.message}
        >
          <Controller
            name="email"
            control={form.control}
            render={({ field }) => <Input autoComplete="off" placeholder="user@company.ru" {...field} />}
          />
        </Form.Item>

        <Form.Item
          label="Пароль"
          required
          validateStatus={errors.password ? 'error' : undefined}
          help={errors.password?.message}
        >
          <Controller
            name="password"
            control={form.control}
            render={({ field }) => (
              <Input.Password autoComplete="new-password" placeholder="Минимум 6 символов, буква и цифра" {...field} />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Подтверждение пароля"
          required
          validateStatus={errors.confirmPassword ? 'error' : undefined}
          help={errors.confirmPassword?.message}
        >
          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field }) => <Input.Password autoComplete="new-password" {...field} />}
          />
        </Form.Item>

        <Space wrap style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void handleGeneratePassword()}>
            Сгенерировать
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => void handleCopyPassword()}>
            Скопировать
          </Button>
        </Space>

        {(role === 'ADMIN' || role === 'EMPLOYEE' || role === 'DRIVER' || role === 'CLIENT') && (
          <Form.Item
            label="Имя"
            required={role !== 'EMPLOYEE'}
            validateStatus={errors.name ? 'error' : undefined}
            help={errors.name?.message}
          >
            <Controller
              name="name"
              control={form.control}
              render={({ field }) => <Input placeholder={role === 'EMPLOYEE' ? 'Необязательно' : 'Имя'} {...field} />}
            />
          </Form.Item>
        )}

        {role === 'EMPLOYEE' && (
          <Form.Item
            label="Должность"
            validateStatus={errors.position ? 'error' : undefined}
            help={errors.position?.message}
          >
            <Controller
              name="position"
              control={form.control}
              render={({ field }) => <Input placeholder="Сотрудник" {...field} />}
            />
          </Form.Item>
        )}

        {role === 'SUPPLIER' && (
          <>
            <Form.Item
              label="Компания"
              required
              validateStatus={errors.companyName ? 'error' : undefined}
              help={errors.companyName?.message}
            >
              <Controller
                name="companyName"
                control={form.control}
                render={({ field }) => <Input {...field} />}
              />
            </Form.Item>
            <Form.Item
              label="Контактное лицо"
              required
              validateStatus={errors.contactPerson ? 'error' : undefined}
              help={errors.contactPerson?.message}
            >
              <Controller
                name="contactPerson"
                control={form.control}
                render={({ field }) => <Input {...field} />}
              />
            </Form.Item>
            <Form.Item label="ИНН" validateStatus={errors.inn ? 'error' : undefined} help={errors.inn?.message}>
              <Controller name="inn" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="ОГРН" validateStatus={errors.ogrn ? 'error' : undefined} help={errors.ogrn?.message}>
              <Controller name="ogrn" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item
              label="Расчётный счёт"
              validateStatus={errors.bankAccount ? 'error' : undefined}
              help={errors.bankAccount?.message}
            >
              <Controller name="bankAccount" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="БИК" validateStatus={errors.bik ? 'error' : undefined} help={errors.bik?.message}>
              <Controller name="bik" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Телефон"
          validateStatus={errors.phone ? 'error' : undefined}
          help={errors.phone?.message ?? 'Если указать, станет номером входа'}
        >
          <Controller
            name="phone"
            control={form.control}
            render={({ field }) => <Input placeholder="+7…" {...field} />}
          />
        </Form.Item>

        <Form.Item
          label="Адрес"
          validateStatus={errors.address ? 'error' : undefined}
          help={errors.address?.message}
        >
          <Controller
            name="address"
            control={form.control}
            render={({ field }) => <Input.TextArea rows={2} {...field} />}
          />
        </Form.Item>

        {role === 'CLIENT' && (
          <Form.Item
            label="Район"
            validateStatus={errors.districtId ? 'error' : undefined}
            help={errors.districtId?.message}
          >
            <Controller
              name="districtId"
              control={form.control}
              render={({ field }) => (
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Необязательно"
                  options={districtOptions}
                  value={field.value ?? undefined}
                  onChange={(value) => field.onChange(value ?? null)}
                  loading={districtsQuery.isPending}
                />
              )}
            />
          </Form.Item>
        )}

        {(role === 'EMPLOYEE' || role === 'DRIVER') && (
          <Form.Item
            label="Районы"
            required={role === 'EMPLOYEE'}
            validateStatus={errors.districts ? 'error' : undefined}
            help={errors.districts?.message}
          >
            <Controller
              name="districts"
              control={form.control}
              render={({ field }) => (
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  placeholder="Выберите районы"
                  options={districtOptions}
                  value={field.value}
                  onChange={field.onChange}
                  loading={districtsQuery.isPending}
                />
              )}
            />
          </Form.Item>
        )}

        {role === 'EMPLOYEE' && (
          <>
            <Form.Item>
              <Controller
                name="allWarehouses"
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onChange={(event) => {
                      field.onChange(event.target.checked);
                      if (event.target.checked) {
                        form.setValue('warehouseIds', []);
                      }
                    }}
                  >
                    Все активные склады
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item
              label="Склады"
              required={!allWarehouses}
              validateStatus={errors.warehouseIds ? 'error' : undefined}
              help={errors.warehouseIds?.message}
            >
              <Controller
                name="warehouseIds"
                control={form.control}
                render={({ field }) => (
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    placeholder="Выберите склады"
                    options={warehouseOptions}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={allWarehouses}
                    loading={warehousesQuery.isPending}
                  />
                )}
              />
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Space wrap>
            <Button onClick={() => navigate('/users')}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              Создать
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
