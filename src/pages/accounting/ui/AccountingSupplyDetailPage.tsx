import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button, Card, Descriptions, Input, InputNumber, Modal, Space, Table, Typography, Grid, Alert, message, Tag,
} from 'antd';
import { getProfile } from '@/entities/user';
import {
  getSupply, receiveSupply, cancelSupply, reverseSupply, lookupBarcode, updateSupply,
  resolveClientProfile, canSeeCost, canReverseSupply, type SupplyDocumentLine,
} from '@/entities/accounting';
import { accountingKeys, createIdempotencyKey, AccountingNav, supplyStatusLabel, SUPPLY_STATUS_COLORS } from '@/features/accounting';
import { getApiMessage, formatDate, formatPrice } from '@/shared/lib';

const { Title } = Typography;

export function AccountingSupplyDetailPage() {
  const { id } = useParams();
  const supplyId = Number(id);
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const receiveKey = useRef(createIdempotencyKey());
  const cancelKey = useRef(createIdempotencyKey());
  const reverseKey = useRef(createIdempotencyKey());
  const [barcode, setBarcode] = useState('');
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseQty, setReverseQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');

  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const profile = resolveClientProfile(user);
  const showCost = canSeeCost(profile);

  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.supply(supplyId),
    queryFn: () => getSupply(supplyId),
    enabled: Number.isFinite(supplyId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: accountingKeys.all });
  };

  const receiveMutation = useMutation({
    mutationFn: () => receiveSupply(supplyId, receiveKey.current),
    onSuccess: () => { message.success('Поставка проведена'); receiveKey.current = createIdempotencyKey(); invalidate(); },
    onError: (err) => message.error(getApiMessage(err)),
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelSupply(supplyId, cancelKey.current),
    onSuccess: () => { message.success('Черновик отменён'); invalidate(); },
    onError: (err) => message.error(getApiMessage(err)),
  });
  const reverseMutation = useMutation({
    mutationFn: () => reverseSupply(supplyId, reverseKey.current, {
      reason,
      lines: Object.entries(reverseQty)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([lineId, quantity]) => ({ lineId: Number(lineId), quantity })),
    }),
    onSuccess: () => {
      message.success('Сторно выполнено');
      reverseKey.current = createIdempotencyKey();
      setReverseOpen(false);
      invalidate();
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const onBarcode = async () => {
    if (!barcode.trim() || !data || data.status !== 'DRAFT') return;
    try {
      const product = await lookupBarcode(barcode.trim());
      const lines = [...(data.lines || [])];
      const existing = lines.find((l) => l.productId === product.id);
      if (existing) existing.quantity += 1;
      else lines.push({ id: 0, productId: product.id, quantity: 1, unitCost: null, reversedQty: 0, product: { id: product.id, name: product.name } });
      await updateSupply(supplyId, {
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      setBarcode('');
      invalidate();
    } catch (err) {
      Modal.warning({ title: 'Товар не найден', content: getApiMessage(err) });
    }
  };

  const columns = useMemo(() => [
    { title: 'Товар', dataIndex: ['product', 'name'] },
    { title: 'Кол-во', dataIndex: 'quantity' },
    ...(showCost ? [{ title: 'Цена', dataIndex: 'unitCost', render: (v: number | null) => (v == null ? '—' : formatPrice(v)) }] : []),
    { title: 'Сторно', dataIndex: 'reversedQty' },
  ], [showCost]);

  if (error) return (
    <div>
      <AccountingNav />
      <Alert type="error" message={getApiMessage(error)} />
    </div>
  );
  if (!data && !isLoading) return (
    <div>
      <AccountingNav />
      <Alert type="error" message="Документ не найден" />
    </div>
  );

  return (
    <div>
      <AccountingNav />
      <Button type="link" onClick={() => navigate('/accounting/supplies')} style={{ paddingLeft: 0 }}>← К списку</Button>
      <Title level={screens.md ? 4 : 5}>Поставка {data?.number}</Title>
      <Card loading={isLoading}>
        <Descriptions column={screens.md ? 2 : 1} size="small">
          <Descriptions.Item label="Статус">
            {data?.status ? <Tag color={SUPPLY_STATUS_COLORS[data.status]}>{supplyStatusLabel(data.status)}</Tag> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Склад">{data?.warehouse?.name}</Descriptions.Item>
          <Descriptions.Item label="Поставщик">{data?.supplier?.companyName}</Descriptions.Item>
          <Descriptions.Item label="Дата">{formatDate(data?.documentDate)}</Descriptions.Item>
          <Descriptions.Item label="Сумма">{formatPrice(data?.totalAmount)}</Descriptions.Item>
        </Descriptions>
        {data?.status === 'DRAFT' && (
          <Space style={{ marginTop: 16 }} wrap>
            <Input
              placeholder="Штрихкод"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onPressEnter={onBarcode}
              style={{ width: 220 }}
            />
            <Button type="primary" loading={receiveMutation.isPending} onClick={() => receiveMutation.mutate()}>Провести</Button>
            <Button danger loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>Отменить черновик</Button>
          </Space>
        )}
        {data && ['RECEIVED', 'PARTIALLY_REVERSED'].includes(data.status) && canReverseSupply(profile) && (
          <Button style={{ marginTop: 16 }} onClick={() => setReverseOpen(true)}>Сторно</Button>
        )}
      </Card>
      <Card title="Строки" style={{ marginTop: 16 }}>
        <Table<SupplyDocumentLine>
          rowKey="id"
          dataSource={data?.lines}
          columns={columns}
          pagination={false}
          scroll={screens.md ? undefined : { x: 560 }}
        />
      </Card>
      <Modal
        title="Сторно поставки"
        open={reverseOpen}
        onCancel={() => setReverseOpen(false)}
        onOk={() => reverseMutation.mutate()}
        confirmLoading={reverseMutation.isPending}
        okText="Сторнировать"
      >
        <Input.TextArea placeholder="Причина" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 12 }} />
        {data?.lines.map((line) => (
          <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>{line.product?.name} (доступно {line.quantity - line.reversedQty})</span>
            <InputNumber min={0} max={line.quantity - line.reversedQty} value={reverseQty[line.id] || 0} onChange={(v) => setReverseQty((p) => ({ ...p, [line.id]: Number(v || 0) }))} />
          </div>
        ))}
      </Modal>
    </div>
  );
}
