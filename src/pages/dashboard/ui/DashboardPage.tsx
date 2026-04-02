import {
  Alert,
  Badge,
  Card,
  Col,
  Divider,
  Empty,
  Progress,
  Rate,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  Grid,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleFilled,
  ShopOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { getProfile } from '@/entities/user/api/profile-api';
import { getProducts } from '@/entities/product/api/product-api';
import { getFeedbacksBySupplierId } from '@/entities/feedback/api/feedback-api';
import type { User } from '@/entities/user';
import type { Product } from '@/entities/product';
import type { Feedback } from '@/entities/feedback';

import { getCriticalStock, getWarehousesList } from '../api/dashboard-api';
import type { CriticalStockItem, WarehouseItem } from '../api/dashboard-api';

const { Title, Text } = Typography;

// ─── Helpers ────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  critical: '#ff4d4f',
  warning:  '#faad14',
  attention:'#1677ff',
  normal:   '#52c41a',
};

const URGENCY_LABEL: Record<string, string> = {
  critical:  'Критично',
  warning:   'Предупреждение',
  attention: 'Внимание',
  normal:    'Норма',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Администратор',
  SUPPLIER: 'Поставщик',
  EMPLOYEE: 'Сотрудник',
  CLIENT: 'Клиент',
};

function pluralProducts(n: number) {
  if (n % 100 >= 11 && n % 100 <= 14) return `${n} товаров`;
  const m = n % 10;
  if (m === 1) return `${n} товар`;
  if (m >= 2 && m <= 4) return `${n} товара`;
  return `${n} товаров`;
}

// ─── Supplier section ────────────────────────────────────────────────────────

interface SupplierDashboardProps {
  user: User;
  products: Product[];
  totalProducts: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  productsLoading: boolean;
  feedbacks: Feedback[];
  feedbacksLoading: boolean;
}

function SupplierDashboard({
  products,
  totalProducts,
  pendingCount,
  approvedCount,
  rejectedCount,
  productsLoading,
  feedbacks,
  feedbacksLoading,
}: SupplierDashboardProps) {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const pendingProducts = products.filter((p) => p.moderationStatus === 'PENDING');
  const rejectedProducts = products.filter((p) => p.moderationStatus === 'REJECTED');

  const feedbackColumns: ColumnsType<Feedback> = [
    {
      title: 'Товар',
      key: 'product',
      ellipsis: true,
      render: (_: unknown, record: Feedback) =>
        record.product?.name ? (
          <Typography.Link onClick={() => navigate(`/products/${record.productId}`)}>
            {record.product.name}
          </Typography.Link>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Оценка',
      dataIndex: 'rating',
      key: 'rating',
      width: 130,
      render: (rating: number) => <Rate disabled value={rating} style={{ fontSize: 13 }} />,
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment: string | null) => comment ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Ответ',
      dataIndex: 'supplierReply',
      key: 'reply',
      width: 90,
      render: (reply: string | null) =>
        reply ? <Tag color="success">Есть</Tag> : <Tag color="default">Нет</Tag>,
    },
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (d: string) => new Date(d).toLocaleDateString('ru-RU'),
    },
  ];

  const rejectedColumns: ColumnsType<Product> = [
    { title: 'Товар', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'Причина',
      dataIndex: 'moderationReason',
      key: 'reason',
      ellipsis: true,
      render: (r: string | null) => r ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Дата',
      dataIndex: 'moderatedAt',
      key: 'moderatedAt',
      width: 100,
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—'),
    },
  ];

  return (
    <div>
      <Title level={isMobile ? 5 : 4} style={{ marginBottom: 20 }}>
        Кабинет поставщика
      </Title>

      {pendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${pluralProducts(pendingCount)} ожидают модерации администратором`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stat cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="Всего товаров"
              value={totalProducts}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="На модерации"
              value={pendingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: pendingCount > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="Одобрено"
              value={approvedCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="Отклонено"
              value={rejectedCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: rejectedCount > 0 ? '#ff4d4f' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* Feedbacks + pending list */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card
            title={
              <span>
                <StarFilled style={{ color: '#faad14', marginRight: 8 }} />
                Последние отзывы на ваши товары
              </span>
            }
            loading={feedbacksLoading}
          >
            {feedbacks.length === 0 ? (
              <Empty description="Отзывов пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={feedbacks}
                columns={feedbackColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={isMobile ? { x: 700 } : undefined}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Ожидают модерации
                {pendingCount > 0 && (
                  <Badge count={pendingCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            loading={productsLoading}
          >
            {pendingProducts.length === 0 ? (
              <Empty
                description="Нет товаров на модерации"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingProducts.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <Typography.Link
                      onClick={() => navigate(`/products/${p.id}`)}
                      ellipsis
                      style={{ maxWidth: isMobile ? 130 : 190 }}
                    >
                      {p.name}
                    </Typography.Link>
                    <Tag color="warning" style={{ marginLeft: 8, flexShrink: 0 }}>
                      Ожидает
                    </Tag>
                  </div>
                ))}
                {pendingProducts.length > 8 && (
                  <Text type="secondary" style={{ textAlign: 'center', marginTop: 4 }}>
                    ещё {pendingProducts.length - 8}…
                  </Text>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Rejected products */}
      {rejectedProducts.length > 0 && (
        <Card
          title={
            <span>
              <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              Отклонённые товары
            </span>
          }
          style={{ marginTop: 16 }}
        >
          <Table
            dataSource={rejectedProducts.slice(0, 10)}
            columns={rejectedColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={isMobile ? { x: 520 } : undefined}
          />
        </Card>
      )}
    </div>
  );
}

// ─── Admin section ───────────────────────────────────────────────────────────

interface AdminDashboardProps {
  isSuperAdmin: boolean;
  products: Product[];
  totalProducts: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  productsLoading: boolean;
  criticalStock: CriticalStockItem[];
  stockLoading: boolean;
  warehouses: WarehouseItem[];
  warehousesLoading: boolean;
}

function AdminDashboard({
  isSuperAdmin,
  products,
  totalProducts,
  pendingCount,
  approvedCount,
  rejectedCount,
  productsLoading,
  criticalStock,
  stockLoading,
  warehouses,
  warehousesLoading,
}: AdminDashboardProps) {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const activeWarehouses = warehouses.filter((w) => w.isActive && !w.maintenanceMode).length;
  const inactiveWarehouses = warehouses.length - activeWarehouses;
  const criticalItems = criticalStock.filter((s) => s.urgency === 'critical');
  const warningItems  = criticalStock.filter((s) => s.urgency === 'warning');
  const pendingProducts = products.filter((p) => p.moderationStatus === 'PENDING');

  const stockColumns: ColumnsType<CriticalStockItem> = [
    {
      title: 'Товар',
      key: 'productName',
      ellipsis: true,
      render: (_: unknown, row: CriticalStockItem) => (
        <Typography.Link onClick={() => navigate(`/products/${row.productId}`)}>
          {row.productName}
        </Typography.Link>
      ),
    },
    {
      title: 'Склад',
      key: 'warehouseName',
      ellipsis: true,
      render: (_: unknown, row: CriticalStockItem) => (
        <Typography.Link onClick={() => navigate(`/warehouses/${row.warehouseId}`)}>
          {row.warehouseName}
        </Typography.Link>
      ),
    },
    {
      title: 'Район',
      dataIndex: 'districtName',
      key: 'districtName',
      ellipsis: true,
    },
    {
      title: 'Остаток',
      dataIndex: 'currentQuantity',
      key: 'currentQuantity',
      width: 90,
      render: (qty: number, record: CriticalStockItem) => (
        <Text style={{ color: URGENCY_COLOR[record.urgency] }} strong>
          {qty} шт
        </Text>
      ),
    },
    {
      title: 'Скорость продаж',
      dataIndex: 'salesRate',
      key: 'salesRate',
      width: 120,
      render: (rate: number, record: CriticalStockItem) => (
        <span>
          {rate.toFixed(1)} шт/мес
          {record.isFastMoving && (
            <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
              Быстрый
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 140,
      render: (urgency: string) => (
        <Tag
          color={
            urgency === 'critical'
              ? 'error'
              : urgency === 'warning'
              ? 'warning'
              : 'processing'
          }
        >
          {URGENCY_LABEL[urgency] ?? urgency}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <Title level={isMobile ? 5 : 4} style={{ marginBottom: 20 }}>
        Панель управления
        <br />
        {isSuperAdmin ? (
          <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px', marginTop: 8 }}>
            Суперадмин
          </Tag>
        ) : (
          <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px', marginTop: 8 }}>
            Администратор
          </Tag>
        )}
      </Title>

      {/* Top alerts */}
      {pendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${pluralProducts(pendingCount)} ожидают модерации`}
          style={{ marginBottom: 12 }}
        />
      )}
      {criticalItems.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`${criticalItems.length} позиций с критически низким остатком на складах`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stat cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="Всего товаров"
              value={totalProducts}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={productsLoading}>
            <Statistic
              title="Ожидают модерации"
              value={pendingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: pendingCount > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={warehousesLoading}>
            <Statistic
              title="Активных складов"
              value={activeWarehouses}
              suffix={`/ ${warehouses.length}`}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={stockLoading}>
            <Statistic
              title="Критичных остатков"
              value={criticalItems.length}
              prefix={
                criticalItems.length > 0 ? (
                  <ExclamationCircleFilled />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              valueStyle={{ color: criticalItems.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Middle row: moderation stats | warehouses | pending list */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Moderation breakdown */}
        <Col xs={24} md={12} xl={8}>
          <Card title="Статусы товаров" loading={productsLoading} style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}
                >
                  <span>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                    Одобрено
                  </span>
                  <Text strong>{approvedCount}</Text>
                </div>
                <Progress
                  percent={
                    totalProducts > 0
                      ? Math.round((approvedCount / totalProducts) * 100)
                      : 0
                  }
                  strokeColor="#52c41a"
                  showInfo={false}
                  size="small"
                />
              </div>

              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}
                >
                  <span>
                    <ClockCircleOutlined style={{ color: '#faad14', marginRight: 6 }} />
                    На модерации
                  </span>
                  <Text strong>{pendingCount}</Text>
                </div>
                <Progress
                  percent={
                    totalProducts > 0
                      ? Math.round((pendingCount / totalProducts) * 100)
                      : 0
                  }
                  strokeColor="#faad14"
                  showInfo={false}
                  size="small"
                />
              </div>

              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}
                >
                  <span>
                    <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
                    Отклонено
                  </span>
                  <Text strong>{rejectedCount}</Text>
                </div>
                <Progress
                  percent={
                    totalProducts > 0
                      ? Math.round((rejectedCount / totalProducts) * 100)
                      : 0
                  }
                  strokeColor="#ff4d4f"
                  showInfo={false}
                  size="small"
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Warehouses list */}
        <Col xs={24} md={12} xl={8}>
          <Card
            title={
              <span>
                <BankOutlined style={{ marginRight: 8 }} />
                Склады
              </span>
            }
            loading={warehousesLoading}
            style={{ height: '100%' }}
          >
            {warehouses.length === 0 ? (
              <Empty description="Нет данных" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {warehouses.slice(0, 7).map((w) => (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/warehouses/${w.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Badge
                        status={
                          w.isActive && !w.maintenanceMode
                            ? 'success'
                            : w.maintenanceMode
                            ? 'warning'
                            : 'error'
                        }
                      />
                      <div style={{ minWidth: 0 }}>
                        <Typography.Link style={{ display: 'block', maxWidth: isMobile ? 120 : 160 }} ellipsis>
                          {w.name}
                        </Typography.Link>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {w.district?.name}
                        </Text>
                      </div>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                      {w._count?.productStocks ?? 0} тов.
                    </Text>
                  </div>
                ))}
                {warehouses.length > 7 && (
                  <Text type="secondary" style={{ textAlign: 'center', marginTop: 4 }}>
                    ещё {warehouses.length - 7}…
                  </Text>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={[8, 8]}>
                  <Col xs={24} sm={12}>
                    <Text style={{ color: '#52c41a' }}>✓ Активных: {activeWarehouses}</Text>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Text style={{ color: inactiveWarehouses > 0 ? '#ff4d4f' : undefined }}>
                      ✕ Неактивных: {inactiveWarehouses}
                    </Text>
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* Pending moderation */}
        <Col xs={24} xl={8}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Товары на модерации
                {pendingCount > 0 && (
                  <Badge count={pendingCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            loading={productsLoading}
            style={{ height: '100%' }}
          >
            {pendingProducts.length === 0 ? (
              <Empty
                description="Нет товаров на модерации"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingProducts.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Typography.Link
                        onClick={() => navigate(`/products/${p.id}`)}
                        ellipsis
                        style={{ display: 'block', maxWidth: isMobile ? 120 : 170 }}
                      >
                        {p.name}
                      </Typography.Link>
                      {p.supplier?.companyName && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {p.supplier.companyName}
                        </Text>
                      )}
                    </div>
                    <Tag color="warning" style={{ marginLeft: 8, flexShrink: 0 }}>
                      Ожидает
                    </Tag>
                  </div>
                ))}
                {pendingProducts.length > 8 && (
                  <Text type="secondary" style={{ textAlign: 'center', marginTop: 4 }}>
                    ещё {pendingProducts.length - 8}…
                  </Text>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Critical stock table */}
      <Card
        title={
          <span>
            <ExclamationCircleFilled style={{ color: '#ff4d4f', marginRight: 8 }} />
            Критические остатки на складах
            {criticalItems.length > 0 && (
              <Tag color="error" style={{ marginLeft: 8 }}>
                {criticalItems.length} критично
              </Tag>
            )}
            {warningItems.length > 0 && (
              <Tag color="warning" style={{ marginLeft: 4 }}>
                {warningItems.length} предупреждений
              </Tag>
            )}
          </span>
        }
        loading={stockLoading}
        style={{ marginTop: 16 }}
      >
        {criticalStock.length === 0 ? (
          <Empty
            description={
              <span>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                Критических остатков нет
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            dataSource={criticalStock}
            columns={stockColumns}
            rowKey={(r) => `${r.productId}-${r.warehouseId}`}
            pagination={false}
            size="small"
            scroll={isMobile ? { x: 760 } : undefined}
            rowClassName={(r) =>
              r.urgency === 'critical' ? 'ant-table-row-selected' : ''
            }
          />
        )}
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: user, isLoading: profileLoading } = useQuery<User>({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isSupplier   = user?.role === 'SUPPLIER';
  const isAdmin      = user?.role === 'ADMIN';
  const isSuperAdmin = isAdmin && user?.admin?.isSuperAdmin === true;

  // Products (for all roles — backend auto-scopes by role)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['dashboard:products', user?.id],
    queryFn:  () => getProducts({ limit: 300 }),
    enabled:  !!user,
  });

  // Feedbacks for supplier
  const supplierId = user?.supplier?.id;
  const { data: feedbacksData, isLoading: feedbacksLoading } = useQuery({
    queryKey: ['dashboard:feedbacks', supplierId],
    queryFn:  () => getFeedbacksBySupplierId(supplierId!, { limit: 10 }),
    enabled:  isSupplier && !!supplierId,
  });

  // Admin: critical stock
  const { data: criticalStockRaw, isLoading: stockLoading } = useQuery({
    queryKey: ['dashboard:critical-stock'],
    queryFn:  () => getCriticalStock(),
    enabled:  isAdmin,
  });
  const criticalStock: CriticalStockItem[] = criticalStockRaw ?? [];

  // Admin: warehouses
  const { data: warehousesRaw, isLoading: warehousesLoading } = useQuery({
    queryKey: ['dashboard:warehouses'],
    queryFn:  getWarehousesList,
    enabled:  isAdmin,
  });
  const warehouses: WarehouseItem[] = warehousesRaw ?? [];

  if (profileLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return null;

  const products      = productsData?.data ?? [];
  const totalProducts = productsData?.pagination?.totalItems ?? products.length;
  const pendingCount  = products.filter((p) => p.moderationStatus === 'PENDING').length;
  const approvedCount = products.filter((p) => p.moderationStatus === 'APPROVED').length;
  const rejectedCount = products.filter((p) => p.moderationStatus === 'REJECTED').length;

  if (isSupplier) {
    return (
      <SupplierDashboard
        user={user}
        products={products}
        totalProducts={totalProducts}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
        productsLoading={productsLoading}
        feedbacks={feedbacksData?.data ?? []}
        feedbacksLoading={feedbacksLoading}
      />
    );
  }

  if (isAdmin) {
    return (
      <AdminDashboard
        isSuperAdmin={isSuperAdmin}
        products={products}
        totalProducts={totalProducts}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
        productsLoading={productsLoading}
        criticalStock={criticalStock}
        stockLoading={stockLoading}
        warehouses={warehouses}
        warehousesLoading={warehousesLoading}
      />
    );
  }

  // Fallback for EMPLOYEE or other roles
  return (
    <div>
      <Title level={4}>Кабинет</Title>
      <Card>
        <p>Добро пожаловать! Ваша роль: {ROLE_LABEL[user.role] ?? user.role}</p>
      </Card>
    </div>
  );
}
