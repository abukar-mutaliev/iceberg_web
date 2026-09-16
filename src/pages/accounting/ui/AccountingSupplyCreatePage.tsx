import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Typography, message } from 'antd';
import { createSupply, lookupBarcode } from '@/entities/accounting';
import { getWarehouses } from '@/entities/warehouse';
import { getSuppliers } from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import { AccountingNav } from '@/features/accounting';

const { Title } = Typography;

interface Line {
  productId: number;
  name: string;
  quantity: number;
  unitCost?: number | null;
}

export function AccountingSupplyCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [lines, setLines] = useState<Line[]>([]);
  const [barcode, setBarcode] = useState('');
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: () => getWarehouses() });
  const warehouses = warehousesData?.warehouses ?? [];
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => getSuppliers() });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createSupply(payload),
    onSuccess: (doc) => {
      message.success('Черновик создан');
      navigate(`/accounting/supplies/${doc.id}`);
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const addBarcode = async () => {
    try {
      const product = await lookupBarcode(barcode.trim());
      if (product.supplierId && !form.getFieldValue('supplierId')) {
        form.setFieldValue('supplierId', product.supplierId);
      }
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === product.id);
        if (existing) return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
        return [...prev, { productId: product.id, name: product.name, quantity: 1, unitCost: null }];
      });
      setBarcode('');
    } catch (err) {
      message.warning(getApiMessage(err));
    }
  };

  return (
    <div>
      <AccountingNav />
      <Title level={4}>Новая поставка</Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{}}
          onFinish={(values) => {
            const documentDate = values.documentDate?.toDate?.()
              ? values.documentDate.toDate().toISOString()
              : new Date().toISOString();
            mutation.mutate({
              number: values.number,
              supplierId: values.supplierId,
              warehouseId: values.warehouseId,
              documentDate,
              comment: values.comment,
              lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost ?? null })),
            });
          }}
        >
          <Form.Item name="number" label="Номер" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="supplierId" label="Поставщик" rules={[{ required: true }]}>
            <Select options={suppliers.map((s) => ({ value: s.id, label: s.companyName }))} />
          </Form.Item>
          <Form.Item name="warehouseId" label="Склад" rules={[{ required: true }]}>
            <Select options={warehouses.map((w: { id: number; name: string }) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item name="documentDate" label="Дата документа" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="comment" label="Комментарий"><Input.TextArea /></Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input placeholder="Штрихкод" value={barcode} onChange={(e) => setBarcode(e.target.value)} onPressEnter={addBarcode} />
            <Button onClick={addBarcode}>Добавить</Button>
          </Space>
          {lines.map((line) => (
            <Space key={line.productId} style={{ display: 'flex', marginBottom: 8 }}>
              <span style={{ minWidth: 180 }}>{line.name}</span>
              <InputNumber min={1} value={line.quantity} onChange={(v) => setLines((p) => p.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(v || 1) } : l)))} />
              <InputNumber placeholder="Цена" value={line.unitCost ?? undefined} onChange={(v) => setLines((p) => p.map((l) => (l.productId === line.productId ? { ...l, unitCost: v } : l)))} />
            </Space>
          ))}
          <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={!lines.length}>Сохранить черновик</Button>
        </Form>
      </Card>
    </div>
  );
}
