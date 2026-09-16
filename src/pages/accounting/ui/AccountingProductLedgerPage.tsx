import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Alert, Empty, Grid } from 'antd';
import { getProfile } from '@/entities/user';
import { getProductLedger, resolveClientProfile, canSeeCost } from '@/entities/accounting';
import { accountingKeys, Money } from '@/features/accounting';
import { getApiMessage, formatDate } from '@/shared/lib';

const { Title } = Typography;

export function AccountingProductLedgerPage() {
  const { id } = useParams();
  const productId = Number(id);
  const screens = Grid.useBreakpoint();
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const showCost = canSeeCost(resolveClientProfile(user));
  const { data, error, isLoading } = useQuery({
    queryKey: accountingKeys.ledger(productId),
    queryFn: () => getProductLedger(productId),
    enabled: Number.isFinite(productId),
  });
  if (error) return <Alert type="error" message={getApiMessage(error)} />;
  if (!data && !isLoading) return <Empty />;
  return (
    <div>
      <Title level={4}>Книга товара {data?.product.name}</Title>
      <Card title="Остатки по складам" loading={isLoading} style={{ marginBottom: 16 }}>
        <Table
          rowKey="warehouseId"
          dataSource={data?.stocks}
          pagination={false}
          columns={[
            { title: 'Склад', dataIndex: 'warehouseName' },
            { title: 'Остаток', dataIndex: 'quantity' },
            { title: 'Резерв', dataIndex: 'reserved' },
            ...(showCost ? [{ title: 'Цена склада', dataIndex: 'warehousePrice', render: (v: number | null) => <Money value={v} /> }] : []),
          ]}
        />
      </Card>
      <Card title="Продажи">
        <Table
          rowKey="id"
          dataSource={data?.sales}
          scroll={screens.md ? undefined : { x: 640 }}
          columns={[
            { title: 'Дата', dataIndex: 'soldAt', render: (v: string) => formatDate(v) },
            { title: 'Кол-во', dataIndex: 'quantity' },
            { title: 'Цена', dataIndex: 'salePriceAtSale', render: (v: number) => <Money value={v} /> },
            ...(showCost ? [{ title: 'Себестоимость', dataIndex: 'costAtSale', render: (v: number) => <Money value={v} /> }] : []),
          ]}
        />
      </Card>
    </div>
  );
}
