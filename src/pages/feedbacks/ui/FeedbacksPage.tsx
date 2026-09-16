import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, List, Rate, Button, Typography, Modal, Input, message, Select, Space, Grid } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { getFeedbacks, replyToFeedback } from '@/entities/feedback';
import { getProfile } from '@/entities/user';
import { getProducts } from '@/entities/product';
import { formatDate } from '@/shared/lib';
import { getApiMessage } from '@/shared/lib';
import type { Feedback } from '@/entities/feedback';

export function FeedbacksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [productFilter, setProductFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: user, isLoading: isProfileLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const supplierId = user?.supplier?.id;
  const isStaff = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';
  const canViewFeedbacks = isStaff || !!supplierId;
  const canReply = !!supplierId;

  const { data: feedbacksData, isLoading } = useQuery({
    queryKey: ['feedbacks', user?.role, page, limit, productFilter],
    queryFn: () => getFeedbacks({ page, limit, productId: productFilter }),
    enabled: canViewFeedbacks,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all', user?.role],
    queryFn: () => getProducts({ page: 1, limit: isStaff ? 500 : 100 }),
    enabled: canViewFeedbacks,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => replyToFeedback(id, text),
    onSuccess: () => {
      message.success('Ответ отправлен');
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      setReplyModalOpen(false);
      setSelectedFeedback(null);
      setReplyText('');
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const handleOpenReply = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setReplyText(feedback.supplierReply ?? '');
    setReplyModalOpen(true);
  };

  const handleSubmitReply = () => {
    if (!selectedFeedback) return;
    replyMutation.mutate({ id: selectedFeedback.id, text: replyText });
  };

  const openProduct = (feedback: Feedback) => {
    if (!feedback.productId) return;
    navigate(`/products/${feedback.productId}`);
  };

  const feedbacks = feedbacksData?.data ?? [];
  const pagination = feedbacksData?.pagination;
  const products = productsData?.data ?? [];

  if (isProfileLoading) {
    return <Typography.Text>Загрузка профиля...</Typography.Text>;
  }
  if (!user) {
    return <Typography.Text type="danger">Не удалось загрузить профиль</Typography.Text>;
  }
  if (!canViewFeedbacks) {
    return (
      <Typography.Text type="secondary">
        Отзывы доступны только для поставщиков и администраторов. Ваша роль: {user.role}.
      </Typography.Text>
    );
  }

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
      >
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          Отзывы
        </Typography.Title>
        <Select
          placeholder="Фильтр по продукту"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: isMobile ? '100%' : 280, maxWidth: '100%' }}
          value={productFilter}
          onChange={(value) => {
            setProductFilter(value);
            setPage(1);
          }}
          options={products.map((p) => ({ label: p.name, value: p.id }))}
        />
      </Space>

      <Card>
        <List
          loading={isLoading}
          dataSource={feedbacks}
          locale={{ emptyText: 'Отзывов пока нет' }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: item.productId ? 'pointer' : 'default' }}
              onClick={() => openProduct(item)}
              actions={
                canReply
                  ? [
                      <Button
                        key="reply"
                        type="link"
                        icon={<MessageOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReply(item);
                        }}
                        block={isMobile}
                      >
                        {item.supplierReply ? 'Изменить ответ' : 'Ответить'}
                      </Button>,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                title={
                  <Space wrap size={8}>
                    <Typography.Link
                      onClick={(e) => {
                        e.stopPropagation();
                        openProduct(item);
                      }}
                    >
                      {item.product?.name ?? item.productName ?? `Продукт #${item.productId}`}
                    </Typography.Link>
                    <Rate disabled value={item.rating} style={{ fontSize: isMobile ? 14 : undefined }} />
                  </Space>
                }
                description={
                  <div>
                    {isStaff && item.product?.supplier?.companyName && (
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                        {item.product.supplier.companyName}
                        {item.client?.name ? ` · ${item.client.name}` : ''}
                      </Typography.Paragraph>
                    )}
                    <Typography.Paragraph style={{ marginBottom: 8 }}>{item.comment ?? '—'}</Typography.Paragraph>
                    {item.supplierReply && (
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                        <strong>{canReply ? 'Ваш ответ:' : 'Ответ поставщика:'}</strong> {item.supplierReply}
                      </Typography.Paragraph>
                    )}
                    <Typography.Text type="secondary">{formatDate(item.createdAt)}</Typography.Text>
                  </div>
                }
              />
            </List.Item>
          )}
          pagination={
            pagination && pagination.totalItems > limit
              ? {
                  current: page,
                  total: pagination.totalItems,
                  pageSize: limit,
                  onChange: setPage,
                }
              : false
          }
        />
      </Card>

      <Modal
        title="Ответ на отзыв"
        open={replyModalOpen}
        onCancel={() => {
          setReplyModalOpen(false);
          setSelectedFeedback(null);
          setReplyText('');
        }}
        onOk={handleSubmitReply}
        okText="Отправить"
        confirmLoading={replyMutation.isPending}
        width={isMobile ? '95vw' : undefined}
      >
        <Input.TextArea
          rows={4}
          placeholder="Введите ответ на отзыв"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
      </Modal>
    </div>
  );
}
