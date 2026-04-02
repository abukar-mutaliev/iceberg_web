import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Table, Tag, Badge, Typography, Input, Space, Button,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { getWarehouses } from '@/entities/warehouse';
import type { WarehouseSummary } from '@/entities/warehouse';

const { Title } = Typography;

export function WarehousesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', search],
    queryFn: () => getWarehouses({ search: search || undefined }),
  });

  const warehouses = data?.warehouses ?? [];

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: WarehouseSummary) => (
        <Space>
          <Typography.Link onClick={() => navigate(`/warehouses/${row.id}`)}>
            {name}
          </Typography.Link>
          {row.isMain && <Tag color="gold">Главный</Tag>}
        </Space>
      ),
    },
    {
      title: 'Район',
      key: 'district',
      render: (_: unknown, row: WarehouseSummary) => row.district?.name ?? '—',
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Статус',
      key: 'status',
      width: 140,
      render: (_: unknown, row: WarehouseSummary) => {
        if (row.maintenanceMode)
          return <Badge status="warning" text="Техобслуживание" />;
        if (row.isActive)
          return <Badge status="success" text="Активен" />;
        return <Badge status="error" text="Неактивен" />;
      },
    },
    {
      title: 'Товаров',
      key: 'products',
      width: 90,
      render: (_: unknown, row: WarehouseSummary) => row._count?.productStocks ?? 0,
    },
    {
      title: 'Заказов',
      key: 'orders',
      width: 90,
      render: (_: unknown, row: WarehouseSummary) => row._count?.orders ?? 0,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, row: WarehouseSummary) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/warehouses/${row.id}`)}
        >
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>
          Склады
        </Title>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Поиск по названию или адресу"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={warehouses}
        columns={columns}
        pagination={{ pageSize: 20 }}
        onRow={(row) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/warehouses/${row.id}`) })}
      />
    </div>
  );
}
