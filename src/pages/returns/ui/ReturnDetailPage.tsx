import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Descriptions, Button, Typography, message, Spin, Space } from 'antd';
import { ArrowLeftOutlined, TruckOutlined } from '@ant-design/icons';
import { getReturnById, startReturn, RETURN_STATUS_LABELS } from '@/entities/product-return';
import type { ProductReturnStatus } from '@/entities/product-return';
import { formatDate } from '@/shared/lib';
import { getApiMessage } from '@/shared/lib';

export function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnId = id ? parseInt(id, 10) : 0;

  const { data: returnData, isLoading } = useQuery({
    queryKey: ['product-return', returnId],
    queryFn: () => getReturnById(returnId),
    enabled: returnId > 0,
  });

  const startMutation = useMutation({
    mutationFn: () => startReturn(returnId),
    onSuccess: () => {
      message.success('Возврат начат');
      queryClient.invalidateQueries({ queryKey: ['product-return', returnId] });
      queryClient.invalidateQueries({ queryKey: ['product-returns'] });
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const canStart = returnData?.status === 'APPROVED';

  if (isLoading || !returnData) {
    return <Spin tip="Загрузка..." />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Link onClick={() => navigate('/returns')}>
          <ArrowLeftOutlined /> К списку возвратов
        </Typography.Link>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Возврат #{returnData.id}
        </Typography.Title>
      </Space>

      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Продукт">
            {returnData.product?.name ?? `Продукт #${returnData.productId}`}
          </Descriptions.Item>
          <Descriptions.Item label="Склад">
            {returnData.warehouse?.name ?? returnData.warehouse?.address ?? `Склад #${returnData.warehouseId}`}
          </Descriptions.Item>
          <Descriptions.Item label="Количество">{returnData.quantity}</Descriptions.Item>
          <Descriptions.Item label="Причина">{returnData.reason ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            {RETURN_STATUS_LABELS[returnData.status as ProductReturnStatus] ?? returnData.status}
          </Descriptions.Item>
          <Descriptions.Item label="Дата создания">{formatDate(returnData.createdAt)}</Descriptions.Item>
          {returnData.startedAt && (
            <Descriptions.Item label="Дата начала">{formatDate(returnData.startedAt)}</Descriptions.Item>
          )}
          {returnData.completedAt && (
            <Descriptions.Item label="Дата завершения">{formatDate(returnData.completedAt)}</Descriptions.Item>
          )}
        </Descriptions>

        {canStart && (
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<TruckOutlined />}
              onClick={() => startMutation.mutate()}
              loading={startMutation.isPending}
            >
              Начать возврат
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
