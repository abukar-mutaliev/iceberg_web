import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Grid, Empty, Alert } from 'antd';
import { getProfile } from '@/entities/user';
import { getWarehouseComparison, resolveClientProfile, canSeeCost } from '@/entities/accounting';
import { accountingKeys, PeriodFilter, Money, periodToQuery, AccountingNav } from '@/features/accounting';
import type { PeriodPreset } from '@/features/accounting';
import { getApiMessage } from '@/shared/lib';

const { Title } = Typography;

export function AccountingWarehousesPage() {
  const screens = Grid.useBreakpoint();
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [filters, setFilters] = useState(() => periodToQuery('month'));
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const showCost = canSeeCost(resolveClientProfile(user));
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.warehouses(filters),
    queryFn: () => getWarehouseComparison(filters),
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
      <Title level={screens.md ? 4 : 5}>Сравнение складов</Title>
      <PeriodFilter preset={preset} onChange={(next) => { setPreset(next.preset); setFilters(next); }} />
      <Card style={{ marginTop: 16 }}>
        {!data?.length && !isLoading ? <Empty description="Нет данных" /> : (
          <Table
            rowKey="warehouseId"
            loading={isLoading}
            dataSource={data}
            scroll={screens.md ? undefined : { x: 720 }}
            columns={[
              { title: 'Склад', dataIndex: 'warehouseName' },
              { title: 'Район', dataIndex: 'districtName' },
              { title: 'Выручка', dataIndex: 'sales', render: (v: number) => <Money value={v} /> },
              ...(showCost ? [{ title: 'Прибыль', dataIndex: 'profit', render: (v: number) => <Money value={v} /> }] : []),
              { title: 'Остаток, кор.', dataIndex: 'quantity' },
            ]}
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
}
