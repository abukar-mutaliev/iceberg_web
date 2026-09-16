import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Table, Tag, Typography, Grid, Empty, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getSupplies, type SupplyDocument } from '@/entities/accounting';
import { accountingKeys, AccountingNav, supplyStatusLabel, SUPPLY_STATUS_COLORS } from '@/features/accounting';
import { getApiMessage, formatDate, formatPrice } from '@/shared/lib';

const { Title } = Typography;

export function AccountingSuppliesPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.supplies({ page }),
    queryFn: () => getSupplies({ page, limit: 20 }),
  });
  if (error) return (
    <div>
      <AccountingNav />
      <Alert type="error" message={getApiMessage(error)} />
    </div>
  );
  return (
    <div>
      <AccountingNav
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/accounting/supplies/new')}>
            Новая поставка
          </Button>
        )}
      />
      <Title level={screens.md ? 4 : 5} style={{ marginBottom: 16 }}>Поставки</Title>
      <Card>
        {!data?.items?.length && !isLoading ? <Empty description="Поставок нет" /> : (
          <Table<SupplyDocument>
            rowKey="id"
            loading={isLoading}
            dataSource={data?.items}
            onRow={(row) => ({ onClick: () => navigate(`/accounting/supplies/${row.id}`), style: { cursor: 'pointer' } })}
            scroll={screens.md ? undefined : { x: 720 }}
            columns={[
              { title: 'Номер', dataIndex: 'number' },
              { title: 'Статус', dataIndex: 'status', render: (s: string) => <Tag color={SUPPLY_STATUS_COLORS[s]}>{supplyStatusLabel(s)}</Tag> },
              { title: 'Склад', dataIndex: ['warehouse', 'name'] },
              { title: 'Поставщик', dataIndex: ['supplier', 'companyName'] },
              { title: 'Дата', dataIndex: 'documentDate', render: (v: string) => formatDate(v) },
              { title: 'Сумма', dataIndex: 'totalAmount', render: (v: number) => formatPrice(v) },
            ]}
            pagination={{ current: page, total: data?.pagination.total, onChange: setPage }}
          />
        )}
      </Card>
    </div>
  );
}
