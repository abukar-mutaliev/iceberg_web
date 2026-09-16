import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, InputNumber, Table, Typography, message, Alert, Select, Space } from 'antd';
import {
  getInventoryCount,
  completeInventoryCount,
  createInventoryCount,
  cancelInventoryCount,
  lookupBarcode,
} from '@/entities/accounting';
import { accountingKeys, createIdempotencyKey } from '@/features/accounting';
import { getWarehouses } from '@/entities/warehouse';
import { getApiMessage } from '@/shared/lib';

const { Title } = Typography;

export function AccountingInventoryDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeKey = useRef(createIdempotencyKey());
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [barcode, setBarcode] = useState('');
  const [lines, setLines] = useState<Array<{ productId: number; name: string; expectedQuantity: number; actualQuantity: number; reason?: string }>>([]);

  const { data, error } = useQuery({
    queryKey: accountingKeys.inventoryOne(Number(id)),
    queryFn: () => getInventoryCount(Number(id)),
    enabled: !isNew && Number.isFinite(Number(id)),
  });
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: () => getWarehouses() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: accountingKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: () => createInventoryCount({
      warehouseId,
      documentDate: new Date().toISOString(),
      lines,
    }),
    onSuccess: (doc) => {
      message.success('Черновик создан');
      navigate(`/accounting/inventory/${doc.id}`);
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeInventoryCount(Number(id), completeKey.current),
    onSuccess: () => {
      message.success('Инвентаризация проведена');
      completeKey.current = createIdempotencyKey();
      invalidate();
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelInventoryCount(Number(id)),
    onSuccess: () => {
      message.success('Черновик отменён');
      invalidate();
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const addBarcode = async () => {
    try {
      const product = await lookupBarcode(barcode.trim());
      setLines((prev) => {
        if (prev.some((l) => l.productId === product.id)) return prev;
        return [...prev, { productId: product.id, name: product.name, expectedQuantity: 0, actualQuantity: 0 }];
      });
      setBarcode('');
    } catch (err) {
      message.warning(getApiMessage(err));
    }
  };

  if (error) return <Alert type="error" message={getApiMessage(error)} />;

  const rows = (isNew ? lines : (data?.lines || []).map((l) => ({
    productId: l.productId,
    name: l.product?.name ?? `#${l.productId}`,
    expectedQuantity: l.expectedQuantity,
    actualQuantity: l.actualQuantity,
    reason: l.reason ?? undefined,
  })));

  return (
    <div>
      <Button type="link" onClick={() => navigate('/accounting/inventory')} style={{ paddingLeft: 0 }}>← К списку</Button>
      <Title level={4}>{isNew ? 'Новая инвентаризация' : `Инвентаризация #${id}`}</Title>
      <Card>
        {isNew && (
          <Select
            placeholder="Склад"
            style={{ width: 280, marginBottom: 12 }}
            value={warehouseId}
            onChange={setWarehouseId}
            options={(warehousesData?.warehouses ?? []).map((w: { id: number; name: string }) => ({ value: w.id, label: w.name }))}
          />
        )}
        {isNew && (
          <Space style={{ marginBottom: 12 }}>
            <Input placeholder="Штрихкод" value={barcode} onChange={(e) => setBarcode(e.target.value)} onPressEnter={addBarcode} />
            <Button onClick={addBarcode}>Добавить</Button>
          </Space>
        )}
        <Table
          rowKey="productId"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: 'Товар', dataIndex: 'name' },
            { title: 'Ожидалось', dataIndex: 'expectedQuantity' },
            {
              title: 'Факт',
              dataIndex: 'actualQuantity',
              render: (v: number, row) => isNew ? (
                <InputNumber min={0} value={v} onChange={(n) => setLines((p) => p.map((l) => (l.productId === row.productId ? { ...l, actualQuantity: Number(n || 0) } : l)))} />
              ) : v,
            },
            {
              title: 'Причина',
              dataIndex: 'reason',
              render: (v: string | undefined, row) => isNew ? (
                <Input
                  placeholder="Для большого минуса"
                  value={v}
                  onChange={(e) => setLines((p) => p.map((l) => (l.productId === row.productId ? { ...l, reason: e.target.value } : l)))}
                />
              ) : (v || '—'),
            },
          ]}
        />
        {isNew && (
          <Button type="primary" style={{ marginTop: 12 }} disabled={!warehouseId || !lines.length} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Сохранить
          </Button>
        )}
        {data?.status === 'DRAFT' && (
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" loading={completeMutation.isPending} onClick={() => completeMutation.mutate()}>Провести</Button>
            <Button danger loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>Отменить черновик</Button>
          </Space>
        )}
      </Card>
    </div>
  );
}
