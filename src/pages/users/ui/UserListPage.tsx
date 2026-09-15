import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Grid,
  Input,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { EyeOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import {
  getProfile,
  INCOMPLETE_PROFILE_DISPLAY_NAME,
  USER_ROLE_LABELS,
  type AdminUserListItem,
  type UserRole,
} from '@/entities/user';
import { buildImageUrl, formatDate, getApiMessage } from '@/shared/lib';
import {
  getAdminStaff,
  getAdminUsers,
  UserRoleTag,
  userManagementKeys,
} from '@/features/user-management';
import type { AdminUsersListParams } from '@/features/user-management';

const { Title } = Typography;

const LIMIT = 10;

const ROLE_TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'CLIENT', label: USER_ROLE_LABELS.CLIENT },
  { key: 'EMPLOYEE', label: USER_ROLE_LABELS.EMPLOYEE },
  { key: 'SUPPLIER', label: USER_ROLE_LABELS.SUPPLIER },
  { key: 'DRIVER', label: USER_ROLE_LABELS.DRIVER },
  { key: 'ADMIN', label: USER_ROLE_LABELS.ADMIN },
];

function matchesSearch(row: AdminUserListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.displayName.toLowerCase().includes(q)
    || (row.email ?? '').toLowerCase().includes(q)
    || (row.contactPhone ?? '').toLowerCase().includes(q)
  );
}

export function UserListPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isSuperAdmin = profile?.admin?.isSuperAdmin === true;
  const profileReady = profile != null;

  const [page, setPage] = useState(1);
  const [roleTab, setRoleTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<AdminUsersListParams['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<AdminUsersListParams['sortOrder']>('desc');

  useEffect(() => {
    const next = searchInput.trim();
    const timer = window.setTimeout(() => {
      setSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const roleFilter: UserRole | undefined =
    roleTab === 'all' ? undefined : (roleTab as UserRole);

  const listQuery = useQuery({
    queryKey: userManagementKeys.list({
      page,
      limit: LIMIT,
      search: search || undefined,
      role: roleFilter,
      sortBy,
      sortOrder,
    }),
    queryFn: () => getAdminUsers({
      page,
      limit: LIMIT,
      search: search || undefined,
      role: roleFilter,
      sortBy,
      sortOrder,
    }),
    enabled: profileReady && isSuperAdmin,
  });

  const staffQuery = useQuery({
    queryKey: userManagementKeys.staff({ page, limit: LIMIT }),
    queryFn: () => getAdminStaff({ page, limit: LIMIT }),
    enabled: profileReady && !isSuperAdmin,
  });

  const activeQuery = isSuperAdmin ? listQuery : staffQuery;
  const items = useMemo(() => {
    const rows = activeQuery.data?.items ?? [];
    if (isSuperAdmin) return rows;
    return rows.filter((row) => matchesSearch(row, search));
  }, [activeQuery.data?.items, isSuperAdmin, search]);

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Имя',
      dataIndex: 'displayName',
      key: 'displayName',
      width: isMobile ? 220 : undefined,
      render: (_: string, row) => (
        <Space>
          <Avatar size="small" src={buildImageUrl(row.avatar) || undefined} icon={<UserOutlined />} />
          <Typography.Link onClick={() => navigate(`/users/${row.userId}`)}>
            {row.displayName}
          </Typography.Link>
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      sorter: isSuperAdmin,
      sortOrder: isSuperAdmin && sortBy === 'role'
        ? (sortOrder === 'asc' ? 'ascend' : 'descend')
        : undefined,
      render: (_: UserRole, row) => (
        <UserRoleTag role={row.role} isSuperAdmin={row.isSuperAdmin} />
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      width: isMobile ? 220 : undefined,
      sorter: isSuperAdmin,
      sortOrder: isSuperAdmin && sortBy === 'email'
        ? (sortOrder === 'asc' ? 'ascend' : 'descend')
        : undefined,
      render: (email: string | null) => email || '—',
    },
    {
      title: 'Контакт',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 150,
      render: (phone: string | null) => phone || '—',
    },
    {
      title: 'Создан',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: isSuperAdmin,
      sortOrder: isSuperAdmin && sortBy === 'createdAt'
        ? (sortOrder === 'asc' ? 'ascend' : 'descend')
        : undefined,
      render: (value: string) => formatDate(value),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: unknown, row) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/users/${row.userId}`);
          }}
        >
          Открыть
        </Button>
      ),
    },
  ];

  const handleTableChange: TableProps<AdminUserListItem>['onChange'] = (pagination, _filters, sorter) => {
    if (pagination.current) setPage(pagination.current);
    if (!isSuperAdmin) return;

    const current = Array.isArray(sorter) ? sorter[0] : sorter;
    if (current?.order && (current.field === 'createdAt' || current.field === 'email' || current.field === 'role')) {
      setSortBy(current.field);
      setSortOrder(current.order === 'ascend' ? 'asc' : 'desc');
      return;
    }
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
      >
        <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          {isSuperAdmin ? 'Пользователи' : 'Персонал'}
        </Title>
        <Space wrap style={{ width: isMobile ? '100%' : undefined }} direction={isMobile ? 'vertical' : 'horizontal'}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={isSuperAdmin ? 'Поиск по email, имени, компании' : 'Поиск на текущей странице'}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ width: isMobile ? '100%' : 320, maxWidth: '100%' }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block={isMobile}
            onClick={() => navigate('/users/new')}
          >
            Создать
          </Button>
        </Space>
      </Space>

      {isSuperAdmin && (
        <Tabs
          activeKey={roleTab}
          onChange={(key) => {
            setRoleTab(key);
            setPage(1);
          }}
          items={ROLE_TABS}
          style={{ marginBottom: 8 }}
        />
      )}

      {activeQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={getApiMessage(activeQuery.error)}
        />
      )}

      <Table
        rowKey="userId"
        loading={activeQuery.isPending || !profileReady}
        dataSource={items}
        columns={columns}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? { x: 1100 } : undefined}
        locale={{
          emptyText: (
            <Empty
              description={
                items.length === 0 && search
                  ? 'Ничего не найдено'
                  : isSuperAdmin
                    ? 'Пользователи не найдены'
                    : 'Персонал не найден'
              }
            />
          ),
        }}
        pagination={{
          current: page,
          total: activeQuery.data?.total ?? 0,
          pageSize: LIMIT,
          showSizeChanger: false,
        }}
        onChange={handleTableChange}
        onRow={(row) => ({
          style: { cursor: 'pointer' },
          onClick: () => navigate(`/users/${row.userId}`),
        })}
        rowClassName={(row) =>
          row.displayName === INCOMPLETE_PROFILE_DISPLAY_NAME ? 'ant-table-row-incomplete' : ''
        }
      />
    </div>
  );
}
