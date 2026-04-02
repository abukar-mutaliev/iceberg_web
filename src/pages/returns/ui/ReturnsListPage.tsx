import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Typography, Select } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { getReturnHistory, RETURN_STATUS_LABELS } from '@/entities/product-return';
import type { ProductReturnStatus, ProductReturn } from '@/entities/product-return';
import { formatDate } from '@/shared/lib';

const statusOptions: { value: ProductReturnStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  ...Object.entries(RETURN_STATUS_LABELS).map(([value, label]) => ({ value: value as ProductReturnStatus, label })),
];

export function ReturnsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<ProductReturnStatus | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['product-returns', page, limit, statusFilter],
    queryFn: () =>
      getReturnHistory({
        page,
        limit,
        status: statusFilter || undefined,
      }),
    retry: false,
  });

  const rawData = data?.data;
  const returnsList = Array.isArray(rawData) ? rawData : [];
  const pagination = data?.pagination;

  const statusColor: Record<ProductReturnStatus, string> = {
    PENDING: 'orange',
    APPROVED: 'blue',
    REJECTED: 'red',
    IN_PROGRESS: 'cyan',
    COMPLETED: 'green',
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Продукт',
      dataIndex: ['product', 'name'],
      key: 'product',
      render: (_: unknown, row: ProductReturn) =>
        row.product?.name ?? `Продукт #${row.productId}`,
    },
    {
      title: 'Склад',
      dataIndex: ['warehouse', 'name'],
      key: 'warehouse',
      render: (_: unknown, row: ProductReturn) =>
        row.warehouse?.name ?? `Склад #${row.warehouseId}`,
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: ProductReturnStatus) => (
        <Tag color={statusColor[status] ?? 'default'}>{RETURN_STATUS_LABELS[status] ?? status}</Tag>
      ),
    },
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: unknown, row: ProductReturn) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/returns/${row.id}`)}>
          Подробнее
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Возвраты
        </Typography.Title>
        <Select
          placeholder="Статус"
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter((v as ProductReturnStatus) ?? '')}
          options={statusOptions}
          style={{ width: 160 }}
          allowClear
        />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={returnsList}
        pagination={
          pagination
            ? {
                current: pagination.currentPage,
                total: pagination.totalItems,
                pageSize: limit,
                onChange: setPage,
                showSizeChanger: false,
              }
            : false
        }
      />
    </div>
  );
}
