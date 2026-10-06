import { Card, Col, Row, Statistic } from 'antd';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { OrderStatus } from '@/entities/order';
import { getOrders } from '../api/orders-api';
import { orderAdminKeys } from '../model/query-keys';

const CARDS: { status: OrderStatus; title: string; color: string }[] = [
  { status: 'AWAITING_CONFIRMATION', title: 'Взвешивание', color: '#1677ff' },
  { status: 'PICKING', title: 'Сборка', color: '#fa8c16' },
  { status: 'IN_DELIVERY', title: 'В доставке', color: '#722ed1' },
  { status: 'WAITING_STOCK', title: 'Ждут товар', color: '#d48806' },
];

export function OrderQueueCards() {
  const navigate = useNavigate();
  const queries = useQueries({
    queries: CARDS.map((card) => ({
      queryKey: orderAdminKeys.list({ status: card.status, page: 1, limit: 1 }),
      queryFn: () => getOrders({ status: card.status, page: 1, limit: 1 }),
      staleTime: 30_000,
    })),
  });

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {CARDS.map((card, index) => (
        <Col xs={24} sm={12} md={6} key={card.status}>
          <Card
            hoverable
            loading={queries[index]?.isLoading}
            onClick={() => navigate(`/orders?status=${card.status}`)}
          >
            <Statistic
              title={card.title}
              value={queries[index]?.data?.pagination.total ?? 0}
              valueStyle={{ color: card.color }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
