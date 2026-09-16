import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Typography, Alert, Empty } from 'antd';
import { getProfile } from '@/entities/user';
import { getAccountingControl, resolveClientProfile, canSeeCost } from '@/entities/accounting';
import { accountingKeys } from '@/features/accounting';
import { getApiMessage } from '@/shared/lib';

const { Title } = Typography;

export function AccountingControlPage() {
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const showCost = canSeeCost(resolveClientProfile(user));
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.control(),
    queryFn: getAccountingControl,
  });
  if (error) return <Alert type="error" message={getApiMessage(error)} />;
  if (!data && !isLoading) return <Empty />;
  return (
    <div>
      <Title level={4}>Контроль</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="Отрицательные остатки" value={data?.negativeStocks} valueStyle={{ color: (data?.negativeStocks || 0) > 0 ? '#ff4d4f' : undefined }} /></Card></Col>
        <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="quantity &lt; reserved" value={data?.quantityBelowReserved} /></Card></Col>
        {showCost && (
          <>
            <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="Оценочная себестоимость" value={data?.estimatedCostSales} /></Card></Col>
            <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="Поставки без цены" value={data?.suppliesWithoutCost} /></Card></Col>
          </>
        )}
        <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="Зависшие DRAFT" value={data?.staleDrafts} /></Card></Col>
        <Col xs={24} sm={12} md={8}><Card loading={isLoading}><Statistic title="Закрытые периоды" value={data?.closedPeriods} /></Card></Col>
      </Row>
    </div>
  );
}
