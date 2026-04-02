import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, List, Rate, Button, Typography, Modal, Input, message, Select, Space } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { getFeedbacksBySupplierId, replyToFeedback } from '@/entities/feedback';
import { getProfile } from '@/entities/user';
import { getProducts } from '@/entities/product';
import { formatDate } from '@/shared/lib';
import { getApiMessage } from '@/shared/lib';
import type { Feedback } from '@/entities/feedback';

export function FeedbacksPage() {
  const queryClient = useQueryClient();
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [productFilter, setProductFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: user, isLoading: isProfileLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const supplierId = user?.supplier?.id;

  const { data: feedbacksData, isLoading } = useQuery({
    queryKey: ['feedbacks', supplierId, page, limit, productFilter],
    queryFn: () =>
      supplierId
        ? getFeedbacksBySupplierId(supplierId, { page, limit, productId: productFilter })
        : Promise.resolve({ data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } }),
    enabled: !!supplierId,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ page: 1, limit: 100 }),
    enabled: !!supplierId,
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

  const feedbacks = feedbacksData?.data ?? [];
  const pagination = feedbacksData?.pagination;
  const products = productsData?.data ?? [];

  if (isProfileLoading) {
    return <Typography.Text>Загрузка профиля...</Typography.Text>;
  }
  if (!user) {
    return <Typography.Text type="danger">Не удалось загрузить профиль</Typography.Text>;
  }
  if (!supplierId) {
    return (
      <Typography.Text type="secondary">
        Отзывы доступны только для поставщиков. Ваша роль: {user.role}.
      </Typography.Text>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Отзывы
        </Typography.Title>
        <Select
          placeholder="Фильтр по продукту"
          allowClear
          style={{ width: 220 }}
          value={productFilter}
          onChange={setProductFilter}
          options={products.map((p) => ({ label: p.name, value: p.id }))}
        />
      </Space>

      <Card>
        <List
          loading={isLoading}
          dataSource={feedbacks}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="reply"
                  type="link"
                  icon={<MessageOutlined />}
                  onClick={() => handleOpenReply(item)}
                >
                  {item.supplierReply ? 'Изменить ответ' : 'Ответить'}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.product?.name ?? `Продукт #${item.productId}`}</span>
                    <Rate disabled value={item.rating} />
                  </Space>
                }
                description={
                  <div>
                    <Typography.Paragraph>{item.comment ?? '—'}</Typography.Paragraph>
                    {item.supplierReply && (
                      <Typography.Paragraph type="secondary">
                        <strong>Ваш ответ:</strong> {item.supplierReply}
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
