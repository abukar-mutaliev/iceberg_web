import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  DatePicker,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import {
  ORDER_QUEUE_TABS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  isOrderPaid,
  type OrderListItem,
  type OrderStatus,
} from '@/entities/order';
import { getWarehouses } from '@/entities/warehouse';
import { PROCESSING_ROLE_LABELS, type ProcessingRole } from '@/entities/user';
import {
  getOrders,
  getStaffEmployees,
  orderAdminKeys,
  type OrderListParams,
} from '@/features/order-admin';
import { formatDate, formatPrice, getApiMessage } from '@/shared/lib';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COUNT_STATUSES = ORDER_QUEUE_TABS.map((tab) => tab.key).filter((key): key is OrderStatus => key !== '');

function roleLabel(role?: string | null): string {
  if (!role) return '';
  return PROCESSING_ROLE_LABELS[role as ProcessingRole] ?? role;
}

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? '';
  const status = ORDER_QUEUE_TABS.some((tab) => tab.key === statusParam) ? statusParam : 'ALL';

  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [assignedToId, setAssignedToId] = useState<number | undefined>();
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, warehouseId, assignedToId, urgentOnly, range]);

  const listParams: OrderListParams = {
    page,
    limit: 20,
    status: status === 'ALL' ? undefined : status,
    warehouseId,
    assignedToId,
    urgent: urgentOnly || undefined,
    search: search || undefined,
    startDate: range?.[0].format('YYYY-MM-DD'),
    endDate: range?.[1].format('YYYY-MM-DD'),
  };

  const countFilters: OrderListParams = {
    warehouseId,
    assignedToId,
    urgent: urgentOnly || undefined,
    search: search || undefined,
    startDate: listParams.startDate,
    endDate: listParams.endDate,
    page: 1,
    limit: 1,
  };

  const ordersQuery = useQuery({
    queryKey: orderAdminKeys.list(listParams),
    queryFn: () => getOrders(listParams),
    refetchInterval: 30_000,
  });

  const countQueries = useQueries({
    queries: COUNT_STATUSES.map((queueStatus) => ({
      queryKey: orderAdminKeys.list({ ...countFilters, status: queueStatus }),
      queryFn: () => getOrders({ ...countFilters, status: queueStatus }),
      staleTime: 30_000,
    })),
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'order-filter'],
    queryFn: () => getWarehouses({ limit: 100 }),
    staleTime: 60_000,
  });

  const employeesQuery = useQuery({
    queryKey: orderAdminKeys.employees(),
    queryFn: getStaffEmployees,
    staleTime: 60_000,
  });

  const counts = new Map<string, number>();
  COUNT_STATUSES.forEach((queueStatus, index) => {
    const total = countQueries[index]?.data?.pagination.total;
    if (typeof total === 'number') counts.set(queueStatus, total);
  });

  const columns: ColumnsType<OrderListItem> = [
    {
      title: 'Номер',
      dataIndex: 'orderNumber',
      width: 170,
      render: (orderNumber: string, row) => (
        <Typography.Link onClick={() => navigate(`/orders/${row.id}`)}>{orderNumber}</Typography.Link>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 180,
      render: (value: OrderStatus, row) => (
        <Space size={4} wrap>
          <Tag color={ORDER_STATUS_COLORS[value]}>{ORDER_STATUS_LABELS[value] ?? row.statusLabel}</Tag>
          {row.isUrgent && <Tag color="red">Срочный</Tag>}
          {row.isWeightBased && <Tag color="blue">Весовой</Tag>}
        </Space>
      ),
    },
    {
      title: 'Клиент',
      key: 'client',
      ellipsis: true,
      render: (_, row) => (
        <div>
          <div>{row.client?.name || 'Клиент'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.client?.district?.name || row.deliveryAddress || '—'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Склад',
      key: 'warehouse',
      width: 140,
      ellipsis: true,
      render: (_, row) => row.warehouse?.name ?? '—',
    },
    {
      title: 'Исполнитель',
      key: 'assigned',
      width: 160,
      ellipsis: true,
      render: (_, row) =>
        row.assignedTo ? (
          <span>
            {row.assignedTo.name}
            {roleLabel(row.assignedTo.processingRole) ? (
              <Text type="secondary"> · {roleLabel(row.assignedTo.processingRole)}</Text>
            ) : null}
          </span>
        ) : (
          <Text type="secondary">Не назначен</Text>
        ),
    },
    {
      title: 'Сумма',
      dataIndex: 'totalAmount',
      width: 120,
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: 'Оплата',
      key: 'payment',
      width: 120,
      render: (_, row) =>
        isOrderPaid(row.payment) ? (
          <Tag color="success">Оплачен</Tag>
        ) : (
          <Tag>{row.payment ? (PAYMENT_STATUS_LABELS[row.payment.status] ?? row.payment.status) : 'Нет оплаты'}</Tag>
        ),
    },
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => formatDate(value),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Заказы</Title>

      <Tabs
        activeKey={status}
        onChange={(key) => {
          const next = new URLSearchParams(searchParams);
          if (key && key !== 'ALL') next.set('status', key);
          else next.delete('status');
          setSearchParams(next);
        }}
        items={ORDER_QUEUE_TABS.map((tab) => ({
          key: tab.key || 'ALL',
          label: tab.key ? (
            <span>
              {tab.label}{' '}
              <Badge
                count={counts.get(tab.key) ?? 0}
                showZero
                color={tab.key === status ? '#1677ff' : '#d9d9d9'}
                overflowCount={999}
              />
            </span>
          ) : tab.label,
        }))}
      />

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Номер, имя или телефон"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          style={{ width: 240 }}
        />
        <Select
          allowClear
          placeholder="Склад"
          style={{ width: 200 }}
          value={warehouseId}
          onChange={(value) => setWarehouseId(value)}
          options={(warehousesQuery.data?.warehouses ?? []).map((warehouse) => ({
            value: warehouse.id,
            label: warehouse.name,
          }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Исполнитель"
          style={{ width: 220 }}
          value={assignedToId}
          onChange={(value) => setAssignedToId(value)}
          options={(employeesQuery.data ?? []).map((employee) => ({
            value: employee.id,
            label: roleLabel(employee.processingRole)
              ? `${employee.name} · ${roleLabel(employee.processingRole)}`
              : employee.name,
          }))}
        />
        <RangePicker
          value={range}
          format="DD.MM.YYYY"
          onChange={(values) => {
            if (values?.[0] && values[1]) setRange([values[0], values[1]]);
            else setRange(null);
          }}
        />
        <Space>
          <Switch checked={urgentOnly} onChange={setUrgentOnly} />
          <Text>Срочные</Text>
        </Space>
      </Space>

      {ordersQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={getApiMessage(ordersQuery.error)}
        />
      )}

      <Table<OrderListItem>
        rowKey="id"
        columns={columns}
        dataSource={ordersQuery.data?.data ?? []}
        loading={ordersQuery.isLoading}
        scroll={{ x: 1100 }}
        locale={{ emptyText: 'Заказов нет' }}
        pagination={{
          current: page,
          pageSize: 20,
          total: ordersQuery.data?.pagination.total ?? 0,
          showSizeChanger: false,
          onChange: setPage,
        }}
        onRow={(row) => ({
          onClick: () => navigate(`/orders/${row.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
