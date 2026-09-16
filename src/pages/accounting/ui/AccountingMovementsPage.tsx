import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Grid, Empty, Alert } from 'antd';
import { getStockHistory } from '@/entities/accounting';
import { accountingKeys, PeriodFilter, periodToQuery, AccountingNav, stockOperationLabel, sourceLabel } from '@/features/accounting';
import type { PeriodPreset } from '@/features/accounting';
import { getApiMessage, formatDate } from '@/shared/lib';

const { Title } = Typography;

export function AccountingMovementsPage() {
  const screens = Grid.useBreakpoint();
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [filters, setFilters] = useState(() => ({ ...periodToQuery('month'), page: 1, limit: 20 }));
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.movements(filters),
    queryFn: () => getStockHistory(filters),
  });
  if (error) return (
    <div>
      <AccountingNav />
      <Alert type="error" message={getApiMessage(error)} />
    </div>
  );
  return (
    <div>
      <AccountingNav />
      <Title level={screens.md ? 4 : 5}>Движения склада</Title>
      <PeriodFilter preset={preset} onChange={(next) => { setPreset(next.preset); setFilters((p) => ({ ...p, ...next, page: 1 })); }} />
      <Card style={{ marginTop: 16 }}>
        {!data?.items?.length && !isLoading ? <Empty description="Движений нет" /> : (
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={data?.items as Array<Record<string, unknown>>}
            scroll={screens.md ? undefined : { x: 800 }}
            columns={[
              { title: 'Дата', dataIndex: 'createdAt', render: (v: string) => formatDate(v) },
              { title: 'Операция', dataIndex: 'operation', render: (v: string) => stockOperationLabel(v) },
              { title: 'Товар', dataIndex: ['product', 'name'] },
              { title: 'Склад', dataIndex: ['warehouse', 'name'] },
              { title: 'Кол-во', dataIndex: 'quantity' },
              { title: 'Источник', key: 'source', render: (_: unknown, row: Record<string, unknown>) => sourceLabel(row.sourceType, row.sourceId) },
            ]}
            pagination={{
              current: filters.page,
              total: data?.pagination.total,
              onChange: (page) => setFilters((p) => ({ ...p, page })),
            }}
          />
        )}
      </Card>
    </div>
  );
}
