import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import {
  PROCESSING_ROLE_LABELS,
  PROCESSING_ROLES,
  USER_ROLE_LABELS,
  type UserDetail,
  type UserRole,
} from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import { changeUserRole } from '../api/admin-users-api';
import { ApiRequestError } from '../api/request';
import { getDistrictsForSelection, getWarehousesForSelection } from '../api/selection-api';
import { userManagementKeys } from '../model/query-keys';
import {
  changeRoleFormSchema,
  emptyChangeRoleValues,
  valuesToChangeRolePayload,
  type ChangeRoleFormState,
} from '../model/schemas';

const ROLE_WARNING =
  'Текущий профиль роли будет удалён. Если у пользователя есть клиентские заказы, запись клиента в базе останется, но роль аккаунта изменится. Возвраты поставщика будут удалены. Номер входа не изменится, если он уже задан.';

const CHANGE_FIELD_NAMES = new Set<string>([
  'newRole',
  'isSuperAdmin',
  'name',
  'phone',
  'address',
  'position',
  'processingRole',
  'warehouseIds',
  'districts',
  'districtId',
  'companyName',
  'contactPerson',
  'inn',
  'ogrn',
  'bankAccount',
  'bik',
]);

const ALL_ROLES: UserRole[] = ['ADMIN', 'EMPLOYEE', 'SUPPLIER', 'DRIVER', 'CLIENT'];

function defaultsFromUser(
  user: UserDetail,
  newRole: UserRole,
  forceSuperAdmin = false,
): ChangeRoleFormState {
  const next = emptyChangeRoleValues(newRole);
  next.phone = user.contactPhone ?? '';
  next.isSuperAdmin = forceSuperAdmin || (newRole === 'ADMIN' && user.isSuperAdmin);

  const profile = user.profile;
  if (profile.kind === 'CLIENT') {
    next.name = profile.data.name ?? '';
    next.address = profile.data.address ?? '';
    next.districtId = profile.data.district?.id ?? profile.data.districtId ?? null;
  } else if (profile.kind === 'EMPLOYEE') {
    next.name = profile.data.name ?? '';
    next.address = profile.data.address ?? '';
    next.position = profile.data.position ?? '';
    next.processingRole = profile.data.processingRole ?? null;
    next.warehouseIds = profile.data.warehouses?.map((item) => item.id)
      ?? (profile.data.warehouse?.id ? [profile.data.warehouse.id] : []);
    next.districts = profile.data.districts?.map((item) => item.id) ?? [];
  } else if (profile.kind === 'SUPPLIER') {
    next.address = profile.data.address ?? '';
    next.companyName = profile.data.companyName ?? '';
    next.contactPerson = profile.data.contactPerson ?? '';
    next.inn = profile.data.inn ?? '';
    next.ogrn = profile.data.ogrn ?? '';
    next.bankAccount = profile.data.bankAccount ?? '';
    next.bik = profile.data.bik ?? '';
  } else if (profile.kind === 'DRIVER') {
    next.name = profile.data.name ?? '';
    next.address = profile.data.address ?? '';
    next.districts = profile.data.districts?.map((item) => item.id) ?? [];
  } else if (profile.kind === 'ADMIN') {
    next.name = profile.data.name ?? '';
    next.address = profile.data.address ?? '';
  }

  return next;
}

interface ChangeRoleModalProps {
  open: boolean;
  user: UserDetail;
  currentUserId?: number;
  forceSuperAdmin?: boolean;
  onClose: () => void;
}

export function ChangeRoleModal({
  open,
  user,
  currentUserId,
  forceSuperAdmin = false,
  onClose,
}: ChangeRoleModalProps) {
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const hideSuperAdminSwitch = user.userId === currentUserId;

  const form = useForm<ChangeRoleFormState>({
    resolver: zodResolver(changeRoleFormSchema),
    defaultValues: defaultsFromUser(user, forceSuperAdmin ? 'ADMIN' : user.role, forceSuperAdmin),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultsFromUser(user, forceSuperAdmin ? 'ADMIN' : user.role, forceSuperAdmin));
  }, [open, user, forceSuperAdmin, form]);

  const newRole = form.watch('newRole');
  const allWarehouses = form.watch('allWarehouses');

  const warehousesQuery = useQuery({
    queryKey: userManagementKeys.warehouseSelection(),
    queryFn: () => getWarehousesForSelection(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const districtsQuery = useQuery({
    queryKey: userManagementKeys.districtSelection(),
    queryFn: getDistrictsForSelection,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const warehouseOptions = (warehousesQuery.data ?? [])
    .filter((item) => item.isActive !== false)
    .map((item) => ({ label: item.name, value: item.id }));
  const districtOptions = (districtsQuery.data ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));

  const mutation = useMutation({
    mutationFn: (values: ChangeRoleFormState) =>
      changeUserRole(user.userId, valuesToChangeRolePayload(values)),
    onSuccess: async (serverMessage) => {
      message.success(serverMessage);
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.all });
      onClose();
    },
    onError: (error) => {
      let applied = false;
      if (error instanceof ApiRequestError) {
        error.fieldErrors.forEach(({ path, message: fieldMessage }) => {
          if (CHANGE_FIELD_NAMES.has(path)) {
            form.setError(path as keyof ChangeRoleFormState, { type: 'server', message: fieldMessage });
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
    const current = form.getValues();
    form.reset({
      ...defaultsFromUser(user, nextRole, false),
      name: current.name,
      phone: current.phone,
      address: current.address,
      newRole: nextRole,
      isSuperAdmin: nextRole === 'ADMIN' ? current.isSuperAdmin : false,
    });
  };

  const errors = form.formState.errors;

  return (
    <Modal
      title={forceSuperAdmin ? 'Назначить суперадмином' : 'Сменить роль'}
      open={open}
      onCancel={onClose}
      width={isMobile ? '100%' : 720}
      style={isMobile ? { top: 8, padding: 0 } : undefined}
      footer={null}
      destroyOnClose
    >
      <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={ROLE_WARNING} />

      <Form
        layout="vertical"
        onFinish={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Form.Item
          label="Новая роль"
          required
          validateStatus={errors.newRole ? 'error' : undefined}
          help={errors.newRole?.message}
        >
          <Controller
            name="newRole"
            control={form.control}
            render={({ field }) => (
              <Select
                {...field}
                disabled={forceSuperAdmin}
                options={ALL_ROLES.map((item) => ({
                  label: USER_ROLE_LABELS[item],
                  value: item,
                }))}
                onChange={(value: UserRole) => handleRoleChange(value)}
              />
            )}
          />
        </Form.Item>

        {newRole === 'ADMIN' && !hideSuperAdminSwitch && (
          <Form.Item label="Суперадминистратор">
            <Controller
              name="isSuperAdmin"
              control={form.control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  disabled={forceSuperAdmin}
                />
              )}
            />
          </Form.Item>
        )}

        {newRole !== 'SUPPLIER' && (
          <Form.Item
            label="Имя"
            validateStatus={errors.name ? 'error' : undefined}
            help={errors.name?.message}
          >
            <Controller name="name" control={form.control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        )}

        {newRole === 'EMPLOYEE' && (
          <>
            <Form.Item
              label="Должность"
              validateStatus={errors.position ? 'error' : undefined}
              help={errors.position?.message}
            >
              <Controller name="position" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item
              label="Обработка заказов"
              validateStatus={errors.processingRole ? 'error' : undefined}
              help={errors.processingRole?.message}
            >
              <Controller
                name="processingRole"
                control={form.control}
                render={({ field }) => (
                  <Select
                    allowClear
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange(value ?? null)}
                    options={PROCESSING_ROLES.map((item) => ({
                      label: PROCESSING_ROLE_LABELS[item],
                      value: item,
                    }))}
                  />
                )}
              />
            </Form.Item>
          </>
        )}

        {newRole === 'SUPPLIER' && (
          <>
            <Form.Item
              label="Компания"
              required
              validateStatus={errors.companyName ? 'error' : undefined}
              help={errors.companyName?.message}
            >
              <Controller name="companyName" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item
              label="Контактное лицо"
              required
              validateStatus={errors.contactPerson ? 'error' : undefined}
              help={errors.contactPerson?.message}
            >
              <Controller name="contactPerson" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="ИНН">
              <Controller name="inn" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="ОГРН">
              <Controller name="ogrn" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="Расчётный счёт">
              <Controller name="bankAccount" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="БИК">
              <Controller name="bik" control={form.control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Контактный телефон"
          validateStatus={errors.phone ? 'error' : undefined}
          help={errors.phone?.message ?? 'Заполнит номер входа, только если он ещё пуст'}
        >
          <Controller name="phone" control={form.control} render={({ field }) => <Input placeholder="+7…" {...field} />} />
        </Form.Item>

        <Form.Item
          label="Адрес"
          validateStatus={errors.address ? 'error' : undefined}
          help={errors.address?.message}
        >
          <Controller name="address" control={form.control} render={({ field }) => <Input.TextArea rows={2} {...field} />} />
        </Form.Item>

        {newRole === 'CLIENT' && (
          <Form.Item
            label="Район"
            required
            validateStatus={errors.districtId ? 'error' : undefined}
            help={errors.districtId?.message}
          >
            <Controller
              name="districtId"
              control={form.control}
              render={({ field }) => (
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={districtOptions}
                  value={field.value ?? undefined}
                  onChange={(value) => field.onChange(value ?? null)}
                  loading={districtsQuery.isPending}
                />
              )}
            />
          </Form.Item>
        )}

        {(newRole === 'EMPLOYEE' || newRole === 'DRIVER') && (
          <Form.Item
            label="Районы"
            required={newRole === 'EMPLOYEE'}
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
                  options={districtOptions}
                  value={field.value}
                  onChange={field.onChange}
                  loading={districtsQuery.isPending}
                />
              )}
            />
          </Form.Item>
        )}

        {newRole === 'EMPLOYEE' && (
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
                      if (event.target.checked) form.setValue('warehouseIds', []);
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
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              Сохранить
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
