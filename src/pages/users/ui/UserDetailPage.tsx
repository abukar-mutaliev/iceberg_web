import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Grid,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import {
  getProfile,
  INCOMPLETE_PROFILE_DISPLAY_NAME,
  type Employee,
  type UserDetail,
} from '@/entities/user';
import { buildImageUrl, formatDate, getApiMessage } from '@/shared/lib';
import {
  ChangeRoleModal,
  DeleteUserModal,
  DriverAssignmentsForm,
  EmployeeAssignmentsForm,
  getAdminUser,
  getDriverDistricts,
  getDriverWarehouse,
  getEmployeeDetails,
  UserRoleTag,
  userManagementKeys,
} from '@/features/user-management';

const { Title, Text } = Typography;

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Мужской',
  FEMALE: 'Женский',
  OTHER: 'Другой',
  PREFER_NOT_TO_SAY: 'Предпочитаю не указывать',
};

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function mergeDetail(user: UserDetail, employee?: Employee): UserDetail {
  if (user.profile.kind !== 'EMPLOYEE' || !employee) return user;
  return {
    ...user,
    profile: {
      kind: 'EMPLOYEE',
      data: { ...user.profile.data, ...employee },
    },
    contactPhone: employee.phone ?? user.contactPhone,
  };
}

export function UserDetailPage() {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const userId = Number(userIdParam);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isSuperAdmin = profile?.admin?.isSuperAdmin === true;

  const userQuery = useQuery({
    queryKey: userManagementKeys.detail(userId),
    queryFn: () => getAdminUser(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });

  const employeeId = userQuery.data?.employeeId ?? 0;
  const employeeQuery = useQuery({
    queryKey: userManagementKeys.employee(employeeId),
    queryFn: () => getEmployeeDetails(employeeId),
    enabled: userQuery.data?.role === 'EMPLOYEE' && employeeId > 0,
  });

  const driverId = userQuery.data?.driverId ?? 0;
  const driverDistrictsQuery = useQuery({
    queryKey: [...userManagementKeys.driver(driverId), 'districts'],
    queryFn: () => getDriverDistricts(driverId),
    enabled: userQuery.data?.role === 'DRIVER' && driverId > 0,
  });
  const driverWarehouseQuery = useQuery({
    queryKey: [...userManagementKeys.driver(driverId), 'warehouse'],
    queryFn: () => getDriverWarehouse(driverId),
    enabled: userQuery.data?.role === 'DRIVER' && driverId > 0,
  });

  const user = useMemo(
    () => (userQuery.data ? mergeDetail(userQuery.data, employeeQuery.data) : undefined),
    [userQuery.data, employeeQuery.data],
  );

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  if (!Number.isInteger(userId) || userId < 1) {
    return (
      <Empty description="Некорректный пользователь">
        <Button onClick={() => navigate('/users')}>К списку</Button>
      </Empty>
    );
  }

  if (userQuery.isPending) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <Empty description={getApiMessage(userQuery.error) || 'Пользователь не найден'}>
        <Button type="primary" onClick={() => navigate('/users')}>К списку</Button>
      </Empty>
    );
  }

  const canDelete = isSuperAdmin && user.userId !== profile?.id && !user.isSuperAdmin;
  const canPromote = isSuperAdmin && user.role === 'ADMIN' && !user.isSuperAdmin;
  const incomplete = user.displayName === INCOMPLETE_PROFILE_DISPLAY_NAME;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          К списку
        </Button>
        {isSuperAdmin && (
          <Space wrap>
            <Button onClick={() => setRoleModalOpen(true)}>
              Сменить роль
            </Button>
            {canPromote && (
              <Button onClick={() => setPromoteModalOpen(true)}>
                Назначить суперадмином
              </Button>
            )}
            {canDelete && (
              <Button danger onClick={() => setDeleteModalOpen(true)}>
                Удалить
              </Button>
            )}
          </Space>
        )}
      </Space>

      <Card>
        <Space align="start" size="large" wrap>
          <Avatar
            size={72}
            src={buildImageUrl(user.avatar) || undefined}
            icon={<UserOutlined />}
          />
          <div>
            <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
              {user.displayName}
            </Title>
            <Space wrap style={{ marginTop: 8 }}>
              <UserRoleTag role={user.role} isSuperAdmin={user.isSuperAdmin} />
              {user.twoFactorEnabled && (
                <Tag icon={<SafetyCertificateOutlined />} color="geekblue">2FA</Tag>
              )}
              {incomplete && <Tag color="orange">Профиль не заполнен</Tag>}
              {user.passwordSet === false && <Tag>Вход по SMS</Tag>}
            </Space>
          </div>
        </Space>
      </Card>

      <Card title="Учётная запись">
        <Descriptions column={isMobile ? 1 : 2} size="small">
          <Descriptions.Item label="Email">{dash(user.email)}</Descriptions.Item>
          <Descriptions.Item label="Номер входа">{dash(user.loginPhone)}</Descriptions.Item>
          <Descriptions.Item label="Контакт">{dash(user.contactPhone)}</Descriptions.Item>
          <Descriptions.Item label="Пол">
            {user.gender ? (GENDER_LABELS[user.gender] ?? user.gender) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Был в сети">{formatDate(user.lastSeenAt)}</Descriptions.Item>
          <Descriptions.Item label="Создан">{formatDate(user.createdAt)}</Descriptions.Item>
        </Descriptions>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Номер входа нельзя сменить из админки — только сам пользователь через подтверждение.
        </Text>
      </Card>

      {user.profile.kind === 'CLIENT' && (
        <Card title="Клиент">
          <Descriptions column={isMobile ? 1 : 2} size="small">
            <Descriptions.Item label="Имя">{dash(user.profile.data.name)}</Descriptions.Item>
            <Descriptions.Item label="Район">{dash(user.profile.data.district?.name)}</Descriptions.Item>
            <Descriptions.Item label="Адрес">{dash(user.profile.data.address)}</Descriptions.Item>
            <Descriptions.Item label="Заказов">{user.profile.data.ordersCount ?? '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {user.profile.kind === 'EMPLOYEE' && (
        <>
          <Card title="Сотрудник">
            {employeeQuery.isError && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={getApiMessage(employeeQuery.error)} />
            )}
            <Descriptions column={isMobile ? 1 : 2} size="small">
              <Descriptions.Item label="Имя">{dash(user.profile.data.name)}</Descriptions.Item>
              <Descriptions.Item label="Должность">{dash(user.profile.data.position)}</Descriptions.Item>
              <Descriptions.Item label="Адрес">{dash(user.profile.data.address)}</Descriptions.Item>
              <Descriptions.Item label="Основной склад">{dash(user.profile.data.warehouse?.name)}</Descriptions.Item>
              <Descriptions.Item label="Задач">{user.profile.data.tasksCount ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
          {user.employeeId ? (
            <Card title="Назначения">
              {employeeQuery.isPending ? (
                <Spin />
              ) : (
                <EmployeeAssignmentsForm
                  employee={user.profile.data}
                  isSuperAdmin={isSuperAdmin}
                />
              )}
            </Card>
          ) : null}
        </>
      )}

      {user.profile.kind === 'SUPPLIER' && (
        <Card title="Поставщик">
          <Descriptions column={isMobile ? 1 : 2} size="small">
            <Descriptions.Item label="Компания">{dash(user.profile.data.companyName)}</Descriptions.Item>
            <Descriptions.Item label="Контактное лицо">{dash(user.profile.data.contactPerson)}</Descriptions.Item>
            <Descriptions.Item label="ИНН">{dash(user.profile.data.inn)}</Descriptions.Item>
            <Descriptions.Item label="ОГРН">{dash(user.profile.data.ogrn)}</Descriptions.Item>
            <Descriptions.Item label="Адрес">{dash(user.profile.data.address)}</Descriptions.Item>
            <Descriptions.Item label="Товаров">{user.profile.data.productsCount ?? '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {user.profile.kind === 'DRIVER' && (
        <>
          <Card title="Водитель">
            <Descriptions column={isMobile ? 1 : 2} size="small">
              <Descriptions.Item label="Имя">{dash(user.profile.data.name)}</Descriptions.Item>
              <Descriptions.Item label="Адрес">{dash(user.profile.data.address)}</Descriptions.Item>
              <Descriptions.Item label="Остановок">{user.profile.data.stopsCount ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
          {user.driverId ? (
            <Card title="Назначения">
              <DriverAssignmentsForm
                driverId={user.driverId}
                userId={user.userId}
                districts={driverDistrictsQuery.data ?? user.profile.data.districts ?? []}
                warehouse={driverWarehouseQuery.data ?? user.profile.data.warehouse ?? null}
              />
            </Card>
          ) : null}
        </>
      )}

      {user.profile.kind === 'ADMIN' && (
        <Card title="Администратор">
          <Descriptions column={isMobile ? 1 : 2} size="small">
            <Descriptions.Item label="Имя">{dash(user.profile.data.name)}</Descriptions.Item>
            <Descriptions.Item label="Адрес">{dash(user.profile.data.address)}</Descriptions.Item>
            <Descriptions.Item label="Суперадмин">
              {user.profile.data.isSuperAdmin ? 'Да' : 'Нет'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <ChangeRoleModal
        open={roleModalOpen}
        user={user}
        currentUserId={profile?.id}
        onClose={() => setRoleModalOpen(false)}
      />
      <ChangeRoleModal
        open={promoteModalOpen}
        user={user}
        currentUserId={profile?.id}
        forceSuperAdmin
        onClose={() => setPromoteModalOpen(false)}
      />
      <DeleteUserModal
        open={deleteModalOpen}
        user={user}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => navigate('/users')}
      />
    </Space>
  );
}
