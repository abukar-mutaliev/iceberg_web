import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Space, Typography, Tag, Descriptions, Modal, Skeleton, Image, Form, InputNumber, Input, Grid } from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getProductById, deleteProduct, getProductDisplayPrices, moderateProduct } from '@/entities/product';
import { getProfile } from '@/entities/user';
import { getApiMessage, buildImageUrl } from '@/shared/lib';
import { message } from 'antd';
import type { Product } from '@/entities/product';

const { Title, Text, Paragraph } = Typography;

const MODERATION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Одобрен', color: '#10b981', icon: <CheckCircleOutlined /> },
  PENDING: { label: 'На проверке', color: '#f59e0b', icon: <ClockCircleOutlined /> },
  REJECTED: { label: 'Отклонён', color: '#ef4444', icon: <CloseCircleOutlined /> },
};

function ImageGallery({ images, isMobile }: { images: string[]; isMobile: boolean }) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div
        style={{
          height: isMobile ? 240 : 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
          borderRadius: 16,
          gap: 12,
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <Text style={{ color: '#94a3b8' }}>Нет изображений</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Main image */}
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          height: isMobile ? 260 : 360,
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <Image
          src={buildImageUrl(images[active])}
          alt={`Изображение ${active + 1}`}
          style={{ maxHeight: isMobile ? 260 : 360, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          preview={true}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='3'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {images.map((img, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              style={{
                flexShrink: 0,
                width: 72,
                height: 72,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                border: `2px solid ${i === active ? '#6366f1' : '#e2e8f0'}`,
                transition: 'border-color 0.18s',
                background: '#f8fafc',
              }}
            >
              <img
                src={buildImageUrl(img)}
                alt={`thumb-${i}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ product, viewerRole, isMobile }: { product: Product; viewerRole?: string; isMobile: boolean }) {
  const mod = MODERATION_CONFIG[product.moderationStatus];
  const { unitPrice, boxPrice: displayBoxPrice } = getProductDisplayPrices(product, { viewerRole });
  const showApprovedUnderProposal =
    viewerRole === 'SUPPLIER' &&
    product.moderationStatus === 'PENDING' &&
    (product.supplierProposedPrice != null || product.supplierProposedBoxPrice != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Name + status */}
      <div>
        <div>
          <Title
            level={isMobile ? 5 : 3}
            style={{
              margin: 0,
              color: '#0f172a',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {product.name}
          </Title>
          <Space size={6} wrap style={{ marginTop: 10 }}>
            <Tag
              style={{
                background: product.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: product.isActive ? '#10b981' : '#ef4444',
                border: `1px solid ${product.isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 20,
                padding: '2px 10px',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {product.isActive ? 'Активен' : 'Неактивен'}
            </Tag>
            {mod && (
              <Tag
                icon={mod.icon}
                style={{
                  background: `${mod.color}18`,
                  color: mod.color,
                  border: `1px solid ${mod.color}40`,
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                {mod.label}
              </Tag>
            )}
          </Space>
        </div>

        {product.categories?.length ? (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {product.categories.map((cat) => (
              <Tag
                key={cat.id}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {cat.name}
              </Tag>
            ))}
          </div>
        ) : null}
      </div>

      {/* Price block */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
          borderRadius: 14,
            padding: isMobile ? '14px 14px' : '16px 20px',
          border: '1px solid #e0e7ff',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 120 : 140}px, 1fr))`,
            gap: 16,
          }}
        >
          <div>
            <Text style={{ color: '#64748b', fontSize: isMobile ? 11 : 12, display: 'block' }}>Цена за штуку</Text>
            <Text strong style={{ color: '#4f46e5', fontSize: isMobile ? 18 : 22, lineHeight: 1.3 }}>
              {unitPrice.toLocaleString('ru-RU')} ₽
            </Text>
          </div>
          {displayBoxPrice != null && displayBoxPrice > 0 ? (
            <div>
              <Text style={{ color: '#64748b', fontSize: isMobile ? 11 : 12, display: 'block' }}>Цена за коробку</Text>
              <Text strong style={{ color: '#0f172a', fontSize: isMobile ? 17 : 20, lineHeight: 1.3 }}>
                {displayBoxPrice.toLocaleString('ru-RU')} ₽
              </Text>
            </div>
          ) : null}
          <div>
            <Text style={{ color: '#64748b', fontSize: isMobile ? 11 : 12, display: 'block' }}>В коробке</Text>
            <Text strong style={{ color: '#0f172a', fontSize: isMobile ? 17 : 20, lineHeight: 1.3 }}>
              {product.itemsPerBox} шт.
            </Text>
          </div>
          <div>
            <Text style={{ color: '#64748b', fontSize: isMobile ? 11 : 12, display: 'block' }}>Остаток</Text>
            <Text strong style={{ color: '#0f172a', fontSize: isMobile ? 17 : 20, lineHeight: 1.3 }}>
              {product.stockQuantity.toLocaleString('ru-RU')} шт.
            </Text>
          </div>
        </div>
        {showApprovedUnderProposal ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
            Утверждённые на витрине до модерации: {product.price.toLocaleString('ru-RU')} ₽ / шт.
            {product.boxPrice != null ? ` · коробка ${product.boxPrice.toLocaleString('ru-RU')} ₽` : ''}
          </Text>
        ) : null}
      </div>

      {/* Details */}
      <Descriptions column={1} size="small" style={{ marginTop: 4 }}>
        {product.weight ? (
          <Descriptions.Item label="Вес">
            {product.weight} кг
          </Descriptions.Item>
        ) : null}
        {product.boxInfo?.minimumOrder ? (
          <Descriptions.Item label="Минимальный заказ">
            {product.boxInfo.minimumOrder} шт.
          </Descriptions.Item>
        ) : null}
        {viewerRole !== 'SUPPLIER' && product.supplierProposedPrice != null ? (
          <Descriptions.Item label="Предложенная цена (поставщик)">
            {product.supplierProposedPrice.toLocaleString('ru-RU')} ₽
          </Descriptions.Item>
        ) : null}
        {product.moderationReason ? (
          <Descriptions.Item label="Причина отклонения">
            <Text type="danger">{product.moderationReason}</Text>
          </Descriptions.Item>
        ) : null}
      </Descriptions>

      {/* Description */}
      {product.description && (
        <div>
          <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Описание
          </Text>
          <Paragraph style={{ color: '#334155', marginTop: 6, marginBottom: 0, lineHeight: 1.7 }}>
            {product.description}
          </Paragraph>
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const productId = id ? parseInt(id, 10) : 0;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveForm] = Form.useForm<{ price: number; boxPrice?: number; reason?: string }>();
  const [rejectForm] = Form.useForm<{ reason: string }>();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: productId > 0,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isAdmin = profile?.role === 'ADMIN';

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(productId),
    onSuccess: () => {
      message.success('Продукт удалён');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      navigate('/products', { replace: true });
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const moderateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof moderateProduct>[1]) => moderateProduct(productId, payload),
    onSuccess: (_, payload) => {
      message.success(payload.action === 'approve' ? 'Продукт одобрен' : 'Продукт отклонён');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      setApproveModalOpen(false);
      setRejectModalOpen(false);
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const handleApproveOpen = () => {
    if (!product) return;
    const proposedPrice = product.supplierProposedPrice ?? product.price;
    const proposedBoxPrice = product.supplierProposedBoxPrice ?? product.boxPrice ?? product.boxInfo?.boxPrice;
    approveForm.setFieldsValue({ price: proposedPrice, boxPrice: proposedBoxPrice ?? undefined });
    setApproveModalOpen(true);
  };

  const handleApproveSubmit = async () => {
    const values = await approveForm.validateFields();
    moderateMutation.mutate({ action: 'approve', price: values.price, boxPrice: values.boxPrice, reason: values.reason });
  };

  const handleRejectSubmit = async () => {
    const values = await rejectForm.validateFields();
    moderateMutation.mutate({ action: 'reject', reason: values.reason });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Skeleton.Button active style={{ width: 160, height: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
          <Skeleton.Image active style={{ width: '100%', height: 360 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <Card>
        <Space direction="vertical">
          <Text type="danger">Не удалось загрузить продукт</Text>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
            Вернуться к списку
          </Button>
        </Space>
      </Card>
    );
  }

  const isPending = product.moderationStatus === 'PENDING';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ color: '#64748b', padding: '4px 8px' }}
          block={isMobile}
        >
          Назад
        </Button>

        <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
          {isAdmin && isPending && (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ background: '#10b981', borderColor: '#10b981' }}
                onClick={handleApproveOpen}
                block={isMobile}
              >
                Одобрить
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => { rejectForm.resetFields(); setRejectModalOpen(true); }}
                block={isMobile}
              >
                Отклонить
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${productId}/edit`)}
            block={isMobile}
          >
            Редактировать
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setDeleteModalOpen(true)}
            block={isMobile}
          >
            Удалить
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 1fr) minmax(320px, 1.2fr)',
          gap: isMobile ? 16 : 28,
          alignItems: 'start',
        }}
      >
        {/* Left: gallery */}
        <Card
          variant="borderless"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', borderRadius: 18 }}
          styles={{ body: { padding: isMobile ? 12 : 20 } }}
        >
          <ImageGallery images={product.images ?? []} isMobile={isMobile} />
        </Card>

        {/* Right: info */}
        <Card
          variant="borderless"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', borderRadius: 18 }}
          styles={{ body: { padding: isMobile ? 16 : 28 } }}
        >
          <InfoCard product={product} viewerRole={profile?.role} isMobile={isMobile} />
        </Card>
      </div>

      {/* Delete modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
            Удалить продукт?
          </Space>
        }
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={() => deleteMutation.mutate()}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        width={isMobile ? '95vw' : 420}
      >
        <Paragraph style={{ margin: '16px 0 0' }}>
          Продукт <Text strong>«{product.name}»</Text> будет удалён. Это действие нельзя отменить.
        </Paragraph>
      </Modal>

      {/* Approve modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#10b981' }} />
            Одобрить продукт
          </Space>
        }
        open={approveModalOpen}
        onCancel={() => setApproveModalOpen(false)}
        onOk={handleApproveSubmit}
        okText="Одобрить"
        cancelText="Отмена"
        okButtonProps={{ style: { background: '#10b981', borderColor: '#10b981' }, loading: moderateMutation.isPending }}
        width={isMobile ? '95vw' : 480}
      >
        <Paragraph style={{ margin: '12px 0 16px', color: '#475569' }}>
          Укажите финальные цены для публикации на витрине. По умолчанию используются предложенные поставщиком значения.
        </Paragraph>
        {product.supplierProposedPrice != null && (
          <Paragraph style={{ margin: '0 0 12px', color: '#64748b', fontSize: 13 }}>
            Предложено поставщиком: <Text strong>{product.supplierProposedPrice.toLocaleString('ru-RU')} ₽</Text> / шт.
            {product.supplierProposedBoxPrice != null && (
              <>, коробка <Text strong>{product.supplierProposedBoxPrice.toLocaleString('ru-RU')} ₽</Text></>
            )}
          </Paragraph>
        )}
        <Form form={approveForm} layout="vertical">
          <Form.Item
            name="price"
            label="Финальная цена за штуку (₽)"
            rules={[{ required: true, message: 'Обязательно' }, { type: 'number', min: 0.01, message: 'Должна быть больше 0' }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="boxPrice" label="Финальная цена за коробку (₽)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Комментарий (необязательно)">
            <Input.TextArea rows={2} placeholder="Заметка для поставщика" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject modal */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ef4444' }} />
            Отклонить продукт
          </Space>
        }
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleRejectSubmit}
        okText="Отклонить"
        cancelText="Отмена"
        okButtonProps={{ danger: true, loading: moderateMutation.isPending }}
        width={isMobile ? '95vw' : 420}
      >
        <Paragraph style={{ margin: '12px 0 16px', color: '#475569' }}>
          Укажите причину отклонения. Поставщик увидит её в своём кабинете.
        </Paragraph>
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Причина отклонения"
            rules={[{ required: true, message: 'Укажите причину' }, { min: 5, message: 'Минимум 5 символов' }]}
          >
            <Input.TextArea rows={3} placeholder="Например: изображение не соответствует описанию" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
