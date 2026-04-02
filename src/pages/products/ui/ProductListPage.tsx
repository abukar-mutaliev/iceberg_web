import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Typography, Modal, message, Select, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { getProducts, deleteProduct, MODERATION_STATUS_LABELS, getProductDisplayPrices, moderateProduct } from '@/entities/product';
import type { Product, ProductModerationStatus } from '@/entities/product';
import { getProfile } from '@/entities/user';
import { formatPrice, getApiMessage } from '@/shared/lib';

const statusOptions: { value: ProductModerationStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'PENDING', label: MODERATION_STATUS_LABELS.PENDING },
  { value: 'APPROVED', label: MODERATION_STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: MODERATION_STATUS_LABELS.REJECTED },
];

export function ProductListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<ProductModerationStatus | ''>('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [quickRejectId, setQuickRejectId] = useState<number | null>(null);
  const [quickRejectReason, setQuickRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, limit, statusFilter],
    queryFn: () => getProducts({ page, limit, moderationStatus: statusFilter || undefined }),
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isAdmin = profile?.role === 'ADMIN';

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      message.success('Продукт удалён');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteId(null);
    },
    onError: (err) => message.error(err instanceof Error ? err.message : 'Ошибка удаления'),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof moderateProduct>[1] }) =>
      moderateProduct(id, payload),
    onSuccess: (_, { payload }) => {
      message.success(payload.action === 'approve' ? 'Продукт одобрен' : 'Продукт отклонён');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setQuickRejectId(null);
      setQuickRejectReason('');
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const handleQuickApprove = (row: Product) => {
    const price = row.supplierProposedPrice ?? row.price;
    const boxPrice = row.supplierProposedBoxPrice ?? row.boxPrice ?? row.boxInfo?.boxPrice ?? price * row.itemsPerBox;
    moderateMutation.mutate({ id: row.id, payload: { action: 'approve', price, boxPrice } });
  };

  const filteredData = data?.data ?? [];
  const pagination = data?.pagination;

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: { id: number }) => (
        <Typography.Link onClick={() => navigate(`/products/${row.id}`)}>{name}</Typography.Link>
      ),
    },
    {
      title: 'Поставщик',
      key: 'supplier',
      render: (_: unknown, row: Product) => row.supplier?.companyName ?? '—',
    },
    {
      title: 'Статус',
      dataIndex: 'moderationStatus',
      key: 'moderationStatus',
      render: (status: ProductModerationStatus) => {
        const color = status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'orange';
        return <Tag color={color}>{MODERATION_STATUS_LABELS[status]}</Tag>;
      },
    },
    {
      title: 'Цена за коробку',
      dataIndex: 'boxPrice',
      key: 'boxPrice',
      render: (_v: number | null, row: Product) => {
        const { boxPrice } = getProductDisplayPrices(row, { viewerRole: profile?.role });
        return formatPrice(boxPrice);
      },
    },
    {
      title: 'Остаток (коробок)',
      dataIndex: 'stockQuantity',
      key: 'stockQuantity',
    },
    {
      title: 'Причина отклонения',
      dataIndex: 'moderationReason',
      key: 'moderationReason',
      render: (reason: string | null) => reason ?? '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: isAdmin ? 260 : 120,
      render: (_: unknown, row: Product) => (
        <Space wrap size={4}>
          {isAdmin && row.moderationStatus === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                style={{ color: '#10b981', padding: '0 4px' }}
                icon={<CheckCircleOutlined />}
                loading={moderateMutation.isPending && moderateMutation.variables?.id === row.id && moderateMutation.variables?.payload.action === 'approve'}
                onClick={() => handleQuickApprove(row)}
              >
                Одобрить
              </Button>
              <Button
                type="link"
                size="small"
                danger
                style={{ padding: '0 4px' }}
                icon={<CloseCircleOutlined />}
                onClick={() => { setQuickRejectId(row.id); setQuickRejectReason(''); }}
              >
                Отклонить
              </Button>
            </>
          )}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/products/${row.id}`)}>
            Просмотр
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/products/${row.id}/edit`)}>
            Изменить
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteId(row.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>Продукты</Typography.Title>
        <Select
          placeholder="Статус модерации"
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter((v as ProductModerationStatus) ?? ''); setPage(1); }}
          options={statusOptions}
          style={{ width: 160 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/new')}>
          Создать продукт
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={filteredData}
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

      <Modal
        title="Удалить продукт?"
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onOk={() => deleteId != null && deleteMutation.mutate(deleteId)}
        confirmLoading={deleteMutation.isPending}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <p>Продукт будет удалён. Это действие нельзя отменить.</p>
      </Modal>

      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#ef4444' }} />Отклонить продукт</Space>}
        open={quickRejectId !== null}
        onCancel={() => { setQuickRejectId(null); setQuickRejectReason(''); }}
        onOk={() => {
          if (!quickRejectReason.trim() || quickRejectReason.trim().length < 5) {
            message.warning('Укажите причину (минимум 5 символов)');
            return;
          }
          if (quickRejectId != null) {
            moderateMutation.mutate({ id: quickRejectId, payload: { action: 'reject', reason: quickRejectReason.trim() } });
          }
        }}
        confirmLoading={moderateMutation.isPending}
        okText="Отклонить"
        okButtonProps={{ danger: true }}
        width={420}
      >
        <p style={{ color: '#475569', marginBottom: 12 }}>Укажите причину отклонения. Поставщик увидит её в своём кабинете.</p>
        <Input.TextArea
          rows={3}
          placeholder="Например: изображение не соответствует описанию"
          value={quickRejectReason}
          onChange={(e) => setQuickRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
