import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Checkbox, Input, InputNumber, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { OrderDetail, OrderItemView } from '@/entities/order';
import { confirmOrderPrice, orderAdminKeys } from '@/features/order-admin';
import { formatPrice, getApiMessage } from '@/shared/lib';

const { Text } = Typography;

interface LineDraft {
  actualWeightKg: number | null;
  pricePerKg: number | null;
  remove: boolean;
}

interface ConfirmPricePanelProps {
  order: OrderDetail;
}

function lineDrafts(order: OrderDetail): Record<number, LineDraft> {
  const drafts: Record<number, LineDraft> = {};
  for (const item of order.items) {
    if (!item.isWeightBased) continue;
    drafts[item.id] = {
      actualWeightKg: item.estimatedWeightKg ?? null,
      pricePerKg: item.pricePerKg ?? null,
      remove: false,
    };
  }
  return drafts;
}

export function ConfirmPricePanel({ order }: ConfirmPricePanelProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() => lineDrafts(order));
  const [deliveryFee, setDeliveryFee] = useState<number>(order.deliveryFee ?? 0);
  const [comment, setComment] = useState('');

  const goodsTotal = useMemo(() => {
    return order.items.reduce((sum, item) => {
      if (!item.isWeightBased) {
        return sum + (item.subtotal ?? item.price * item.quantity);
      }
      const draft = drafts[item.id];
      if (!draft || draft.remove) return sum;
      const weight = draft.actualWeightKg ?? 0;
      const perKg = draft.pricePerKg ?? 0;
      if (weight <= 0 || perKg <= 0) return sum;
      return sum + Math.round(weight * perKg * 100) / 100;
    }, 0);
  }, [drafts, order.items]);

  const mutation = useMutation({
    mutationFn: () => {
      const weightItems = order.items.filter((item) => item.isWeightBased);
      const keptWeight = weightItems.filter((item) => !drafts[item.id]?.remove);
      const keptPlain = order.items.filter((item) => !item.isWeightBased);
      if (keptWeight.length + keptPlain.length === 0) {
        throw new Error('В заказе должна остаться хотя бы одна позиция');
      }
      for (const item of keptWeight) {
        const draft = drafts[item.id];
        if (!draft || !(draft.actualWeightKg && draft.actualWeightKg > 0) || !(draft.pricePerKg && draft.pricePerKg > 0)) {
          throw new Error(`Укажите вес и цену за кг для «${item.product?.name || 'позиции'}»`);
        }
      }
      const items = weightItems.map((item) => {
        const draft = drafts[item.id];
        if (draft?.remove) {
          return { orderItemId: item.id, remove: true as const };
        }
        return {
          orderItemId: item.id,
          actualWeightKg: Number(draft?.actualWeightKg),
          pricePerKg: Number(draft?.pricePerKg),
        };
      });
      return confirmOrderPrice(order.id, {
        items,
        deliveryFee,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
    },
    onSuccess: async () => {
      message.success('Цена подтверждена, заказ отправлен клиенту на оплату');
      await queryClient.invalidateQueries({ queryKey: orderAdminKeys.all });
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const updateDraft = (itemId: number, patch: Partial<LineDraft>) => {
    setDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...patch },
    }));
  };

  const columns: ColumnsType<OrderItemView> = [
    {
      title: 'Товар',
      key: 'name',
      render: (_, item) => item.product?.name ?? `Позиция ${item.id}`,
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      width: 90,
    },
    {
      title: 'Факт. вес, кг',
      key: 'weight',
      width: 150,
      render: (_, item) => {
        if (!item.isWeightBased) return '—';
        return (
          <InputNumber
            min={0.001}
            step={0.001}
            style={{ width: '100%' }}
            disabled={drafts[item.id]?.remove}
            value={drafts[item.id]?.actualWeightKg ?? undefined}
            onChange={(value) => updateDraft(item.id, { actualWeightKg: value })}
          />
        );
      },
    },
    {
      title: 'Цена за кг',
      key: 'perKg',
      width: 140,
      render: (_, item) => {
        if (!item.isWeightBased) return '—';
        return (
          <InputNumber
            min={0.01}
            step={1}
            style={{ width: '100%' }}
            disabled={drafts[item.id]?.remove}
            value={drafts[item.id]?.pricePerKg ?? undefined}
            onChange={(value) => updateDraft(item.id, { pricePerKg: value })}
          />
        );
      },
    },
    {
      title: 'Сумма',
      key: 'sum',
      width: 120,
      render: (_, item) => {
        if (!item.isWeightBased) return formatPrice(item.subtotal ?? item.price * item.quantity);
        const draft = drafts[item.id];
        if (draft?.remove) return <Text type="secondary">Убрано</Text>;
        const weight = draft?.actualWeightKg ?? 0;
        const perKg = draft?.pricePerKg ?? 0;
        if (weight <= 0 || perKg <= 0) return '—';
        return formatPrice(Math.round(weight * perKg * 100) / 100);
      },
    },
    {
      title: '',
      key: 'remove',
      width: 110,
      render: (_, item) => item.isWeightBased ? (
        <Checkbox
          checked={drafts[item.id]?.remove}
          onChange={(event) => updateDraft(item.id, { remove: event.target.checked })}
        >
          Убрать
        </Checkbox>
      ) : null,
    },
  ];

  return (
    <Card title="Взвешивание и подтверждение цены" style={{ marginBottom: 16 }}>
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={order.items}
        scroll={{ x: 760 }}
      />
      <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size={12}>
        <Space wrap>
          <Text>Доставка, ₽</Text>
          <InputNumber min={0} value={deliveryFee} onChange={(value) => setDeliveryFee(value ?? 0)} />
          <Text strong>Итого {formatPrice(Math.round((goodsTotal + deliveryFee) * 100) / 100)}</Text>
          {order.estimatedAmount != null && (
            <Text type="secondary">Ориентир при заказе {formatPrice(order.estimatedAmount)}</Text>
          )}
        </Space>
        <Input.TextArea
          rows={2}
          maxLength={500}
          placeholder="Комментарий клиенту"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <Button type="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Подтвердить и отправить клиенту
        </Button>
      </Space>
    </Card>
  );
}
