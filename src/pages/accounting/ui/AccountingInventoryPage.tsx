import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Table, Tag, Typography, Grid, Empty, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getInventoryCounts, type InventoryCount } from '@/entities/accounting';
import { accountingKeys } from '@/features/accounting';
import { getApiMessage, formatDate } from '@/shared/lib';

const { Title } = Typography;

export function AccountingInventoryPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.inventory({ page }),
    queryFn: () => getInventoryCounts({ page, limit: 20 }),
  });
  if (error) return <Alert type="error" message={getApiMessage(error)} />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={screens.md ? 4 : 5} style={{ margin: 0 }}>Инвентаризация</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/accounting/inventory/new')}>Новая</Button>
      </div>
      <Card>
        {!data?.items?.length && !isLoading ? <Empty description="Документов нет" /> : (
          <Table<InventoryCount>
            rowKey="id"
            loading={isLoading}
            dataSource={data?.items}
            onRow={(row) => ({ onClick: () => navigate(`/accounting/inventory/${row.id}`), style: { cursor: 'pointer' } })}
            scroll={screens.md ? undefined : { x: 640 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: 'Статус', dataIndex: 'status', render: (s: string) => <Tag>{s}</Tag> },
              { title: 'Склад', dataIndex: ['warehouse', 'name'] },
              { title: 'Дата', dataIndex: 'documentDate', render: (v: string) => formatDate(v) },
            ]}
            pagination={{ current: page, total: data?.pagination.total, onChange: setPage }}
          />
        )}
      </Card>
    </div>
  );
}
