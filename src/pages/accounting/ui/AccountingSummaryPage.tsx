import { useMemo, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Button, Grid, Empty, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '@/entities/user';
import { getAccountingSummary, resolveClientProfile, canSeeCost } from '@/entities/accounting';
import { accountingKeys, PeriodFilter, Money, periodToQuery, AccountingNav } from '@/features/accounting';
import type { PeriodPreset } from '@/features/accounting';
import { exportAccounting } from '@/entities/accounting';
import { getApiMessage } from '@/shared/lib';
import { message } from 'antd';

const { Title } = Typography;

export function AccountingSummaryPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [filters, setFilters] = useState(() => periodToQuery('month'));
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const profile = resolveClientProfile(user);
  const showCost = canSeeCost(profile);

  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.summary(filters),
    queryFn: () => getAccountingSummary(filters),
  });

  const download = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportAccounting({ ...filters, format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'xlsx' ? 'accounting.xlsx' : 'accounting-sales.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(getApiMessage(err));
    }
  };

  const columns = useMemo(() => [
    { title: 'Дата', dataIndex: 'date', key: 'date' },
    { title: 'Выручка', dataIndex: 'revenue', key: 'revenue', render: (v: number) => <Money value={v} /> },
    ...(showCost ? [
      { title: 'Себестоимость', dataIndex: 'cogs', key: 'cogs', render: (v: number) => <Money value={v} /> },
      { title: 'Прибыль', dataIndex: 'profit', key: 'profit', render: (v: number) => <Money value={v} /> },
    ] : []),
    { title: 'Коробки', dataIndex: 'boxesSold', key: 'boxesSold' },
  ], [showCost]);

  if (error) {
    return (
      <div>
        <AccountingNav
          extra={(
            <>
              <Button onClick={() => download('csv')}>CSV</Button>
              <Button onClick={() => download('xlsx')}>Excel</Button>
            </>
          )}
        />
        <Alert type="error" message={getApiMessage(error)} />
      </div>
    );
  }

  return (
    <div>
      <AccountingNav
        extra={(
          <>
            <Button onClick={() => download('csv')}>CSV</Button>
            <Button onClick={() => download('xlsx')}>Excel</Button>
          </>
        )}
      />
      <Title level={isMobile ? 5 : 4} style={{ marginBottom: 16 }}>Сводка</Title>
      <PeriodFilter
        preset={preset}
        onChange={(next) => {
          setPreset(next.preset);
          setFilters({ period: next.period, startDate: next.startDate, endDate: next.endDate });
        }}
      />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Выручка (нетто)" value={data?.revenue.net} formatter={(v) => <Money value={Number(v)} />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Доставка" value={data?.deliveryRevenue} formatter={(v) => <Money value={Number(v)} />} /></Card>
        </Col>
        {showCost && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card loading={isLoading}><Statistic title="Себестоимость" value={data?.cogs?.total} formatter={(v) => <Money value={Number(v)} />} /></Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card loading={isLoading}><Statistic title="Валовая прибыль" value={data?.grossProfit} formatter={(v) => <Money value={Number(v)} />} /></Card>
            </Col>
          </>
        )}
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Оплаты (нетто)" value={data?.payments.net} formatter={(v) => <Money value={Number(v)} />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Расхождение" value={data?.paymentDifference} formatter={(v) => <Money value={Number(v)} />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Коробок продано" value={data?.boxesSold} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={isLoading}><Statistic title="Доставлено заказов" value={data?.ordersDelivered} /></Card>
        </Col>
      </Row>
      <Card title="По дням" style={{ marginTop: 16 }} extra={<Button type="link" onClick={() => navigate('/accounting/sales')}>Продажи</Button>}>
        {!data?.byDay?.length ? <Empty description="Нет данных за период" /> : (
          <Table
            rowKey="date"
            dataSource={data.byDay}
            columns={columns}
            pagination={false}
            size="small"
            scroll={isMobile ? { x: 640 } : undefined}
          />
        )}
      </Card>
    </div>
  );
}
