import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar, Button, Card, Col, Descriptions, Empty, Row,
  Skeleton, Space, Table, Tag, Tooltip, Typography, Grid,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  RadiusUpleftOutlined,
  ShopOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { getWarehouseById } from '@/entities/warehouse';
import type { WarehouseEmployee, WarehouseProductStock, WorkingHours } from '@/entities/warehouse';
import { buildImageUrl, formatPrice } from '@/shared/lib';

const { Title, Text } = Typography;

// ─── Day labels ──────────────────────────────────────────────────────────────

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
// Display order: Mon … Sun  (1,2,3,4,5,6,0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ─── Working hours schedule ───────────────────────────────────────────────────

function WorkingSchedule({ hours, isMobile }: { hours: WorkingHours[]; isMobile: boolean }) {
  const byDay = Object.fromEntries(hours.map((h) => [h.dayOfWeek, h]));
  const today = new Date().getDay();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(7, minmax(0, 1fr))',
        gap: 8,
        marginTop: 4,
      }}
    >
      {DAY_ORDER.map((day) => {
        const h = byDay[day];
        const isToday = day === today;
        const isOpen  = h?.isOpen ?? false;

        return (
          <div
            key={day}
            style={{
              borderRadius: 12,
              padding: '10px 6px',
              textAlign: 'center',
              background: isToday
                ? isOpen
                  ? 'linear-gradient(135deg,#52c41a22 0%,#b7eb8f44 100%)'
                  : '#fff1f0'
                : isOpen
                ? '#f6ffed'
                : '#fafafa',
              border: isToday
                ? `2px solid ${isOpen ? '#52c41a' : '#ff4d4f'}`
                : '1px solid #f0f0f0',
              position: 'relative',
              transition: 'box-shadow .2s',
            }}
          >
            {isToday && (
              <div
                style={{
                  position: 'absolute',
                  top: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isOpen ? '#52c41a' : '#ff4d4f',
                }}
              />
            )}
            <Text
              strong={isToday}
              style={{ fontSize: 13, display: 'block', color: isToday ? (isOpen ? '#389e0d' : '#cf1322') : '#595959' }}
            >
              {DAY_SHORT[day]}
            </Text>
            {isOpen ? (
              <div style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: '#237804', display: 'block', lineHeight: 1.3 }}>
                  {h.openTime ?? '?'}
                </Text>
                <Text style={{ fontSize: 10, color: '#8c8c8c', display: 'block' }}>—</Text>
                <Text style={{ fontSize: 11, color: '#237804', display: 'block', lineHeight: 1.3 }}>
                  {h.closeTime ?? '?'}
                </Text>
              </div>
            ) : (
              <Text style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6, display: 'block' }}>
                Выходной
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Employees list ───────────────────────────────────────────────────────────

function EmployeeCard({ emp }: { emp: WarehouseEmployee }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
      }}
    >
      <Avatar
        src={emp.user?.avatar ? buildImageUrl(emp.user.avatar) : undefined}
        icon={<UserOutlined />}
        size={40}
        style={{ flexShrink: 0, background: '#1677ff' }}
      />
      <div style={{ minWidth: 0 }}>
        <Text strong ellipsis style={{ display: 'block' }}>
          {emp.name}
        </Text>
        {emp.position && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {emp.position}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {emp.user?.email ?? emp.phone ?? emp.user?.phone ?? '—'}
        </Text>
      </div>
    </div>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusTag({ isActive, maintenanceMode }: { isActive: boolean; maintenanceMode: boolean }) {
  if (maintenanceMode) {
    return (
      <Tag icon={<ToolOutlined />} color="warning" style={{ fontSize: 13, padding: '4px 12px' }}>
        Техобслуживание
      </Tag>
    );
  }
  if (isActive) {
    return (
      <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 13, padding: '4px 12px' }}>
        Активен
      </Tag>
    );
  }
  return (
    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 13, padding: '4px 12px' }}>
      Неактивен
    </Tag>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const { data: warehouse, isLoading, error } = useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => getWarehouseById(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 3 }} style={{ marginBottom: 24 }} />
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} md={8}>
              <Skeleton active />
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <Empty
        description="Склад не найден"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ marginTop: 80 }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warehouses')}>
          К списку складов
        </Button>
      </Empty>
    );
  }

  const productStockColumns = [
    {
      title: 'Товар',
      key: 'product',
      ellipsis: true,
      render: (_: unknown, row: WarehouseProductStock) => (
        <Typography.Link onClick={() => navigate(`/products/${row.productId}`)}>
          {row.product?.name ?? `#${row.productId}`}
        </Typography.Link>
      ),
    },
    {
      title: 'Остаток (кор.)',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (qty: number) => (
        <Text style={{ color: qty === 0 ? '#ff4d4f' : qty <= 5 ? '#faad14' : '#52c41a' }} strong>
          {qty}
        </Text>
      ),
    },
    {
      title: 'Резерв',
      dataIndex: 'reserved',
      key: 'reserved',
      width: 90,
    },
    {
      title: 'Доступно',
      key: 'available',
      width: 100,
      render: (_: unknown, row: WarehouseProductStock) => (
        <Text strong>{row.quantity - row.reserved}</Text>
      ),
    },
    {
      title: 'Цена склада',
      dataIndex: 'warehousePrice',
      key: 'warehousePrice',
      width: 130,
      render: (p: number | null, row: WarehouseProductStock) =>
        p != null ? (
          formatPrice(p)
        ) : (
          <Text type="secondary">{formatPrice(row.product?.price ?? 0)}</Text>
        ),
    },
  ];

  const imageUrl = warehouse.image ? buildImageUrl(warehouse.image) : null;

  return (
    <div>
      {/* ── Back button ── */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/warehouses')}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        К списку складов
      </Button>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
          padding: 0,
          marginBottom: 20,
          position: 'relative',
          minHeight: 160,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'stretch',
        }}
      >
        {/* Left text */}
        <div
          style={{
            flex: 1,
            padding: isMobile ? '20px 16px' : '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 10,
            zIndex: 1,
          }}
        >
          <Space wrap size={8}>
            <StatusTag isActive={warehouse.isActive} maintenanceMode={warehouse.maintenanceMode} />
            {warehouse.isMain && (
              <Tag color="gold" style={{ fontSize: 13, padding: '4px 12px' }}>
                ★ Главный склад
              </Tag>
            )}
            <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
              {warehouse.district?.name ?? '—'}
            </Tag>
          </Space>

          <Title level={isMobile ? 3 : 2} style={{ color: '#fff', margin: 0, wordBreak: 'break-word' }}>
            {warehouse.name}
          </Title>

          <Space wrap size={isMobile ? 10 : 20} style={{ color: 'rgba(255,255,255,0.7)' }}>
            <span>
              <EnvironmentOutlined style={{ marginRight: 6 }} />
              {warehouse.address}
            </span>
            {warehouse.maxDeliveryRadius != null && (
              <span>
                <RadiusUpleftOutlined style={{ marginRight: 6 }} />
                Радиус доставки: {warehouse.maxDeliveryRadius} км
              </span>
            )}
            {warehouse.latitude != null && warehouse.longitude != null && (
              <Tooltip title="Координаты">
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  {warehouse.latitude.toFixed(5)}, {warehouse.longitude.toFixed(5)}
                </span>
              </Tooltip>
            )}
          </Space>

          {warehouse.maintenanceMode && warehouse.maintenanceReason && (
            <div
              style={{
                marginTop: 4,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'rgba(255,173,20,0.15)',
                border: '1px solid rgba(255,173,20,0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                maxWidth: 480,
              }}
            >
              <WarningOutlined style={{ color: '#faad14' }} />
              <Text style={{ color: '#faad14', fontSize: 13 }}>{warehouse.maintenanceReason}</Text>
            </div>
          )}
        </div>

        {/* Right image */}
        {imageUrl && (
          <div
            style={{
              width: isMobile ? '100%' : 260,
              height: isMobile ? 180 : 'auto',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <img
              src={imageUrl}
              alt={warehouse.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, rgba(32,58,67,0.6) 0%, transparent 60%)',
              }}
            />
          </div>
        )}
      </div>

      {/* ══ STAT CHIPS ════════════════════════════════════════════════════════ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          {
            icon: <ShopOutlined />,
            label: 'Позиций товаров',
            value: warehouse.productStocks?.length ?? 0,
            color: '#1677ff',
          },
          {
            icon: <TeamOutlined />,
            label: 'Сотрудников',
            value: warehouse.employees?.length ?? 0,
            color: '#722ed1',
          },
          {
            icon: <ClockCircleOutlined />,
            label: 'Заказов',
            value: warehouse._count?.orders ?? 0,
            color: '#fa8c16',
          },
          {
            icon: <HomeOutlined />,
            label: 'Авто-расписание',
            value: warehouse.autoManageStatus ? 'Включено' : 'Выключено',
            color: warehouse.autoManageStatus ? '#52c41a' : '#8c8c8c',
          },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={12} md={6}>
            <div
              style={{
                borderRadius: 12,
                padding: isMobile ? '12px 12px' : '14px 18px',
                background: '#fff',
                border: '1px solid #f0f0f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${stat.color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: stat.color,
                  flexShrink: 0,
                }}
              >
                {stat.icon}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {stat.label}
                </Text>
                <Text strong style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.2 }}>
                  {stat.value}
                </Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ══ WORKING HOURS + INFO ══════════════════════════════════════════════ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Working hours */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                График работы
              </span>
            }
            variant="borderless"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderRadius: 12, height: '100%' }}
          >
            {warehouse.workingHours?.length ? (
              <WorkingSchedule hours={warehouse.workingHours} isMobile={isMobile} />
            ) : (
              <Empty description="График не задан" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* Info card */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span>
                <EnvironmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                Информация
              </span>
            }
            variant="borderless"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderRadius: 12, height: '100%' }}
          >
            <Descriptions
              column={1}
              size="small"
              styles={{ label: { color: '#8c8c8c', width: isMobile ? 120 : 150 } }}
            >
              <Descriptions.Item label="Район">
                <Tag color="blue">{warehouse.district?.name ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Адрес">{warehouse.address}</Descriptions.Item>
              {warehouse.latitude != null && (
                <Descriptions.Item label="Широта">
                  {warehouse.latitude}
                </Descriptions.Item>
              )}
              {warehouse.longitude != null && (
                <Descriptions.Item label="Долгота">
                  {warehouse.longitude}
                </Descriptions.Item>
              )}
              {warehouse.maxDeliveryRadius != null && (
                <Descriptions.Item label="Радиус доставки">
                  {warehouse.maxDeliveryRadius} км
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Статус">
                <StatusTag
                  isActive={warehouse.isActive}
                  maintenanceMode={warehouse.maintenanceMode}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Главный склад">
                {warehouse.isMain ? (
                  <Tag color="gold">Да</Tag>
                ) : (
                  <Text type="secondary">Нет</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Авто-расписание">
                {warehouse.autoManageStatus ? (
                  <Tag color="green">Включено</Tag>
                ) : (
                  <Tag>Выключено</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Добавлен">
                {new Date(warehouse.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* ══ EMPLOYEES ════════════════════════════════════════════════════════ */}
      <Card
        title={
          <span>
            <TeamOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            Сотрудники
            {warehouse.employees?.length > 0 && (
              <Tag style={{ marginLeft: 10 }}>{warehouse.employees.length}</Tag>
            )}
          </span>
        }
        variant="borderless"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderRadius: 12, marginBottom: 16 }}
      >
        {!warehouse.employees?.length ? (
          <Empty description="Нет прикреплённых сотрудников" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Row gutter={[12, 12]}>
            {warehouse.employees.map((emp) => (
              <Col key={emp.id} xs={24} sm={12} md={8} lg={6}>
                <EmployeeCard emp={emp} />
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* ══ PRODUCT STOCKS ══════════════════════════════════════════════════ */}
      <Card
        title={
          <span>
            <ShopOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            Товары на складе
            {warehouse.productStocks?.length > 0 && (
              <Tag style={{ marginLeft: 10 }}>{warehouse.productStocks.length}</Tag>
            )}
          </span>
        }
        variant="borderless"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderRadius: 12 }}
      >
        {!warehouse.productStocks?.length ? (
          <Empty description="Товаров нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={warehouse.productStocks}
            columns={productStockColumns}
            rowKey="id"
            size="small"
            scroll={isMobile ? { x: 680 } : undefined}
            pagination={{ pageSize: 20 }}
            onRow={(row) => ({
              style: { cursor: 'pointer' },
              onClick: () => navigate(`/products/${row.productId}`),
            })}
          />
        )}
      </Card>
    </div>
  );
}
