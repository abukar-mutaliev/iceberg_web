import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Grid,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import type { StaffApplicationRole, StaffApplicationStatus } from '@/entities/staff-application';
import { USER_ROLE_LABELS } from '@/entities/user';
import { formatDate, getApiMessage } from '@/shared/lib';
import {
  ApproveStaffApplicationModal,
  RejectStaffApplicationModal,
  getStaffApplicationStats,
  getStaffApplications,
  userManagementKeys,
  type StaffApplicationListItem,
} from '@/features/user-management';

const { Title } = Typography;

const LIMIT = 20;

const STATUS_LABELS: Record<StaffApplicationStatus, string> = {
  PENDING: 'Ожидает',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
};

const STATUS_COLORS: Record<StaffApplicationStatus, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
};

const ROLE_OPTIONS: StaffApplicationRole[] = ['EMPLOYEE', 'SUPPLIER', 'DRIVER'];

function applicantName(row: StaffApplicationListItem): string {
  return row.user?.client?.name
    || row.user?.email
    || row.user?.phone
    || `Заявка #${row.id}`;
}

export function StaffApplicationsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StaffApplicationStatus>('PENDING');
  const [desiredRole, setDesiredRole] = useState<StaffApplicationRole | undefined>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<StaffApplicationListItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StaffApplicationListItem | null>(null);

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

  const statsQuery = useQuery({
    queryKey: userManagementKeys.applicationStats(),
    queryFn: getStaffApplicationStats,
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: userManagementKeys.applications({
      page,
      limit: LIMIT,
      status,
      desiredRole,
      search: search || undefined,
    }),
    queryFn: () => getStaffApplications({
      page,
      limit: LIMIT,
      status,
      desiredRole,
      search: search || undefined,
    }),
  });

  const columns: ColumnsType<StaffApplicationListItem> = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Заявитель',
      key: 'applicant',
      render: (_: unknown, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{applicantName(row)}</Typography.Text>
          <Typography.Text type="secondary">
            {row.user?.email || row.user?.phone || '—'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'desiredRole',
      key: 'desiredRole',
      width: 140,
      render: (role: StaffApplicationRole) => USER_ROLE_LABELS[role],
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: StaffApplicationStatus) => (
        <Tag color={STATUS_COLORS[value]}>{STATUS_LABELS[value]}</Tag>
      ),
    },
    {
      title: 'Причина / опыт',
      key: 'details',
      ellipsis: true,
      render: (_: unknown, row) => row.reason || row.experience || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: unknown, row) => row.status === 'PENDING' ? (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              setApproveTarget(row);
            }}
          >
            Одобрить
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              setRejectTarget(row);
            }}
          >
            Отклонить
          </Button>
        </Space>
      ) : null,
    },
  ];

  const stats = statsQuery.data;

  return (
    <div>
      <Title level={isMobile ? 5 : 4} style={{ marginTop: 0 }}>Заявки на присоединение</Title>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Typography.Text type="secondary">Ожидают</Typography.Text>
            <Title level={3} style={{ margin: 0 }}>{stats?.pending ?? '—'}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Typography.Text type="secondary">Одобрены</Typography.Text>
            <Title level={3} style={{ margin: 0 }}>{stats?.approved ?? '—'}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Typography.Text type="secondary">Отклонены</Typography.Text>
            <Title level={3} style={{ margin: 0 }}>{stats?.rejected ?? '—'}</Title>
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Select
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={(Object.keys(STATUS_LABELS) as StaffApplicationStatus[]).map((item) => ({
            label: STATUS_LABELS[item],
            value: item,
          }))}
          style={{ width: isMobile ? '100%' : 180 }}
        />
        <Select
          allowClear
          placeholder="Все роли"
          value={desiredRole}
          onChange={(value) => {
            setDesiredRole(value);
            setPage(1);
          }}
          options={ROLE_OPTIONS.map((item) => ({
            label: USER_ROLE_LABELS[item],
            value: item,
          }))}
          style={{ width: isMobile ? '100%' : 200 }}
        />
        <Input
          prefix={<SearchOutlined />}
          placeholder="Поиск по имени, email, телефону"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          allowClear
          style={{ width: isMobile ? '100%' : 280 }}
        />
      </Space>

      {listQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={getApiMessage(listQuery.error)}
        />
      )}

      <Table
        rowKey="id"
        loading={listQuery.isPending}
        dataSource={listQuery.data?.items ?? []}
        columns={columns}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? { x: 1100 } : undefined}
        locale={{ emptyText: <Empty description="Заявки не найдены" /> }}
        pagination={{
          current: page,
          total: listQuery.data?.total ?? 0,
          pageSize: LIMIT,
          showSizeChanger: false,
        }}
        onChange={(pagination) => {
          if (pagination.current) setPage(pagination.current);
        }}
      />

      <ApproveStaffApplicationModal
        open={approveTarget != null}
        application={approveTarget}
        onClose={() => setApproveTarget(null)}
      />
      <RejectStaffApplicationModal
        open={rejectTarget != null}
        application={rejectTarget}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
}
