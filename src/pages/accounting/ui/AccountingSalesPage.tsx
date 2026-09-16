import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Grid, Empty, Alert, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getProfile } from '@/entities/user';
import { getAccountingSales, resolveClientProfile, canSeeCost, type AccountingSaleRow } from '@/entities/accounting';
import { accountingKeys, PeriodFilter, Money, periodToQuery, AccountingNav, saleTypeLabel } from '@/features/accounting';
import type { PeriodPreset } from '@/features/accounting';
import { getApiMessage, formatDate } from '@/shared/lib';

const { Title } = Typography;

export function AccountingSalesPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [filters, setFilters] = useState(() => ({ ...periodToQuery('month'), page: 1, limit: 20, saleType: undefined as string | undefined }));
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const showCost = canSeeCost(resolveClientProfile(user));

  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.sales(filters),
    queryFn: () => getAccountingSales(filters),
  });

  const columns: ColumnsType<AccountingSaleRow> = [
    { title: 'Дата', dataIndex: 'soldAt', render: (v: string) => formatDate(v) },
    { title: 'Товар', dataIndex: 'productName', ellipsis: true },
    { title: 'Склад', dataIndex: 'warehouseName', ellipsis: true },
    { title: 'Тип', dataIndex: 'saleType', width: 140, render: (v: string) => saleTypeLabel(v) },
    {
      title: 'Заказ',
      dataIndex: 'orderNumber',
      render: (v: string | null, row) => (row.saleType === 'ORDER' && v ? v : '—'),
    },
    { title: 'Кол-во', dataIndex: 'quantity', width: 80 },
    { title: 'Выручка', dataIndex: 'revenue', render: (v: number) => <Money value={v} /> },
    ...(showCost ? [
      { title: 'Себестоимость', dataIndex: 'costAtSale', render: (v: number) => <Money value={v} /> },
      { title: 'Прибыль', dataIndex: 'profitAtSale', render: (v: number) => <Money value={v} /> },
    ] : []),
  ];

  if (error) return (
    <div>
      <AccountingNav />
      <Alert type="error" message={getApiMessage(error)} />
    </div>
  );

  return (
    <div>
      <AccountingNav />
      <Title level={isMobile ? 5 : 4}>Продажи</Title>
      <PeriodFilter
        preset={preset}
        onChange={(next) => {
          setPreset(next.preset);
          setFilters((prev) => ({ ...prev, ...next, page: 1 }));
        }}
      />
      <Select
        allowClear
        placeholder="Тип продажи"
        style={{ width: 180, margin: '12px 0' }}
        value={filters.saleType}
        onChange={(saleType) => setFilters((prev) => ({ ...prev, saleType, page: 1 }))}
        options={[
          { value: 'ORDER', label: 'Заказ' },
          { value: 'STOP', label: 'Фургон' },
          { value: 'DIRECT', label: 'Прямая продажа' },
        ]}
      />
      <Card>
        {!data?.items?.length && !isLoading ? <Empty description="Продаж за период нет" /> : (
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={data?.items}
            columns={columns}
            scroll={isMobile ? { x: 900 } : undefined}
            pagination={{
              current: filters.page,
              pageSize: filters.limit,
              total: data?.pagination.total,
              onChange: (page) => setFilters((prev) => ({ ...prev, page })),
            }}
            summary={() => data?.totals ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>Итого по фильтру</Table.Summary.Cell>
                <Table.Summary.Cell index={5}>{data.totals.boxesSold}</Table.Summary.Cell>
                <Table.Summary.Cell index={6}><Money value={data.totals.net} /></Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null}
          />
        )}
      </Card>
    </div>
  );
}
