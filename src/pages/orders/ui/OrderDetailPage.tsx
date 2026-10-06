import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getProfile, PROCESSING_ROLE_LABELS, type ProcessingRole } from '@/entities/user';
import {
  CHOICE_STATUS_LABELS,
  CHOICE_TYPE_LABELS,
  ORDER_LOG_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRE_DELIVERY_STATUSES,
  canStaffCancel,
  isOrderPaid,
  parseHistoryComment,
  sortHistoryAscending,
  superAdminStatusOptions,
  type OrderItemView,
  type OrderStatus,
} from '@/entities/order';
import {
  assignOrder,
  cancelOrder,
  completeOrderStage,
  downloadOrderInvoice,
  getOrder,
  getOrderReceipt,
  getWarehouseWorkload,
  orderAdminKeys,
  updateOrderStatus,
  verifyPickingScan,
} from '@/features/order-admin';
import { formatDate, formatPrice, getApiMessage } from '@/shared/lib';
import { ConfirmPricePanel } from './ConfirmPricePanel';

const { Title, Text, Link } = Typography;
const ASSIGN_ROLES = new Set(['PICKER', 'COURIER', 'MANAGER']);

function roleLabel(role?: string | null): string {
  if (!role) return '';
  return PROCESSING_ROLE_LABELS[role as ProcessingRole] ?? role;
}

function itemSum(item: OrderItemView, estimated: boolean): number {
  if (item.isWeightBased && estimated && item.estimatedPrice != null) return item.estimatedPrice;
  return item.subtotal ?? item.price * item.quantity;
}

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stageComment, setStageComment] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assignReason, setAssignReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [nextStatus, setNextStatus] = useState<OrderStatus | undefined>();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
  const isSuperAdmin = profileQuery.data?.admin?.isSuperAdmin === true;

  const validId = Number.isInteger(orderId) && orderId > 0;

  const orderQuery = useQuery({
    queryKey: orderAdminKeys.detail(orderId),
    queryFn: () => getOrder(orderId),
    enabled: validId,
  });

  const receiptQuery = useQuery({
    queryKey: orderAdminKeys.receipt(orderId),
    queryFn: () => getOrderReceipt(orderId),
    enabled: orderQuery.isSuccess,
  });

  const order = orderQuery.data;
  const warehouseId = order?.warehouse?.id;

  const workloadQuery = useQuery({
    queryKey: orderAdminKeys.workload(warehouseId ?? 0),
    queryFn: () => getWarehouseWorkload(warehouseId as number),
    enabled: assignOpen && Boolean(warehouseId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: orderAdminKeys.all });
  };

  const scanMutation = useMutation({
    mutationFn: () => verifyPickingScan(orderId, order?.pickingToken ?? ''),
    onSuccess: async () => {
      message.success('Сборка подтверждена');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const stageMutation = useMutation({
    mutationFn: () => completeOrderStage(orderId, stageComment.trim() || undefined),
    onSuccess: async () => {
      message.success(order?.status === 'IN_DELIVERY' ? 'Заказ отмечен доставленным' : 'Заказ передан в доставку');
      setStageComment('');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { assignedToId: number | null; reason?: string }) =>
      assignOrder(orderId, payload.assignedToId, payload.reason),
    onSuccess: async (_result, payload) => {
      message.success(payload.assignedToId ? 'Заказ назначен' : 'Назначение снято');
      setAssignOpen(false);
      setAssignReason('');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId, cancelReason.trim()),
    onSuccess: async () => {
      message.success('Заказ отменён');
      setCancelOpen(false);
      setCancelReason('');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(
      orderId,
      status,
      stageComment.trim() || 'Статус изменён суперадмином за сотрудника',
    ),
    onSuccess: async () => {
      message.success('Статус изменён');
      setNextStatus(undefined);
      setStageComment('');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const returnMutation = useMutation({
    mutationFn: () => updateOrderStatus(orderId, 'RETURNED', stageComment.trim() || undefined),
    onSuccess: async () => {
      message.success('Заказ отмечен как возврат');
      await refresh();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  if (!validId) {
    return <Empty description="Некорректный номер заказа" />;
  }

  if (orderQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <Space direction="vertical">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>К списку</Button>
        <Empty description={getApiMessage(orderQuery.error)} />
      </Space>
    );
  }

  const paid = isOrderPaid(order.payment);
  const estimated = Boolean(order.isWeightBased && !order.priceConfirmedAt);
  const canHandOff = PRE_DELIVERY_STATUSES.includes(order.status)
    && paid
    && (Boolean(order.pickingVerifiedAt) || isSuperAdmin);
  const statusOptions = isSuperAdmin ? superAdminStatusOptions(order.status, paid) : [];
  const canDeliver = order.status === 'IN_DELIVERY' && paid;
  const canScan = Boolean(order.pickingScanRequired && order.pickingToken);
  const receipt = receiptQuery.data?.receipt;
  const history = sortHistoryAscending(order.statusHistory ?? []);
  const assignees = (workloadQuery.data ?? []).filter((employee) =>
    ASSIGN_ROLES.has(employee.processingRole || ''),
  );

  const itemColumns: ColumnsType<OrderItemView> = [
    {
      title: 'Товар',
      key: 'name',
      render: (_, item) => (
        <span>
          {item.product?.name ?? `Товар ${item.id}`}
          {item.isWeightBased && <Tag style={{ marginLeft: 8 }}>Весовой</Tag>}
        </span>
      ),
    },
    { title: 'Кол-во', dataIndex: 'quantity', width: 90 },
    {
      title: 'Цена',
      key: 'price',
      width: 220,
      render: (_, item) => {
        if (!item.isWeightBased) return formatPrice(item.price);
        return (
          <div>
            {item.pricePerKg != null && <div>{formatPrice(item.pricePerKg)} / кг</div>}
            {item.estimatedWeightKg != null && (
              <Text type="secondary">Ориентир {item.estimatedWeightKg} кг</Text>
            )}
            {item.actualWeightKg != null && (
              <div>Факт {item.actualWeightKg} кг</div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Сумма',
      key: 'sum',
      width: 130,
      render: (_, item) => formatPrice(itemSum(item, estimated)),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>К списку</Button>
      </Space>

      <Space align="start" wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>{order.orderNumber}</Title>
          <Space wrap>
            <Tag color={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Tag>
            {order.isUrgent && <Tag color="red">Срочный</Tag>}
            {order.isWeightBased && <Tag color="blue">Весовой</Tag>}
            <Text type="secondary">{order.warehouse?.name ?? 'Склад не указан'}</Text>
            <Text type="secondary">{order.deliveryType === 'PICKUP' ? 'Самовывоз' : 'Доставка'}</Text>
          </Space>
        </div>
        <Button onClick={() => downloadOrderInvoice(order.id, order.orderNumber).catch((error) => message.error(getApiMessage(error)))}>
          Накладная
        </Button>
      </Space>

      {order.status === 'PENDING_PAYMENT' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Ждём оплату клиента. В сборку заказ попадёт после оплаты."
        />
      )}
      {order.status === 'WAITING_STOCK' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            order.waitingDeadline
              ? `Ожидание товара до ${formatDate(order.waitingDeadline)}. Включение заказа делает проверка склада.`
              : 'Ожидание товара. Включение заказа делает проверка склада.'
          }
        />
      )}
      {order.cancelReason && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={`Причина отмены: ${order.cancelReason}`} />
      )}

      {order.status === 'AWAITING_CONFIRMATION' && order.isWeightBased && (
        <ConfirmPricePanel key={`${order.id}-${order.status}`} order={order} />
      )}

      <Card title="Действия" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {(canScan || canHandOff || canDeliver || statusOptions.length > 0) && (
            <Input.TextArea
              rows={2}
              maxLength={500}
              placeholder="Комментарий к этапу"
              value={stageComment}
              onChange={(event) => setStageComment(event.target.value)}
            />
          )}
          <Space wrap>
            {canScan && (
              <Button type="primary" loading={scanMutation.isPending} onClick={() => scanMutation.mutate()}>
                Подтвердить сборку
              </Button>
            )}
            {canHandOff && (
              <Button type="primary" loading={stageMutation.isPending} onClick={() => stageMutation.mutate()}>
                Передать в доставку
              </Button>
            )}
            {canDeliver && (
              <Button type="primary" loading={stageMutation.isPending} onClick={() => stageMutation.mutate()}>
                Доставлен
              </Button>
            )}
            <Button onClick={() => {
              setAssigneeId(order.assignedToId);
              setAssignOpen(true);
            }}
            >
              {order.assignedTo ? 'Переназначить' : 'Назначить'}
            </Button>
            {order.assignedToId != null && (
              <Button
                loading={assignMutation.isPending}
                onClick={() => assignMutation.mutate({
                  assignedToId: null,
                  reason: 'Назначение снято администратором',
                })}
              >
                Снять назначение
              </Button>
            )}
            {canStaffCancel(order.status) && (
              <Button danger onClick={() => setCancelOpen(true)}>Отменить</Button>
            )}
            {order.status === 'DELIVERED' && (
              <Button loading={returnMutation.isPending} onClick={() => returnMutation.mutate()}>
                Возврат
              </Button>
            )}
          </Space>
          {statusOptions.length > 0 && (
            <Space wrap>
              <Select<OrderStatus>
                placeholder="Статус за сотрудника"
                style={{ minWidth: 240 }}
                value={nextStatus}
                onChange={setNextStatus}
                options={statusOptions.map((status) => ({
                  value: status,
                  label: ORDER_STATUS_LABELS[status],
                }))}
              />
              <Button
                type="primary"
                disabled={!nextStatus}
                loading={statusMutation.isPending}
                onClick={() => nextStatus && statusMutation.mutate(nextStatus)}
              >
                Сменить статус
              </Button>
            </Space>
          )}
          {isSuperAdmin && statusOptions.length > 0 && (
            <Text type="secondary">
              Суперадмин проводит заказ сам: сборщик и курьер не нужны. Оплата по-прежнему обязательна.
            </Text>
          )}
          {order.pickingVerifiedAt && (
            <Text type="secondary">Сборка подтверждена {formatDate(order.pickingVerifiedAt)}</Text>
          )}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Клиент" style={{ height: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Имя">{order.client?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Телефон">{order.client?.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{order.client?.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Район">{order.client?.district?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Адрес">{order.deliveryAddress || '—'}</Descriptions.Item>
              <Descriptions.Item label="Комментарий">{order.comment || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Оплата и сумма" style={{ height: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Сумма">{formatPrice(order.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Доставка">{formatPrice(order.deliveryFee ?? 0)}</Descriptions.Item>
              {order.estimatedAmount != null && (
                <Descriptions.Item label="Ориентир">{formatPrice(order.estimatedAmount)}</Descriptions.Item>
              )}
              <Descriptions.Item label="Оплата">
                {paid ? 'Оплачен' : (order.payment ? (PAYMENT_STATUS_LABELS[order.payment.status] ?? order.payment.status) : 'Нет оплаты')}
              </Descriptions.Item>
              <Descriptions.Item label="Дата оплаты">{formatDate(order.payment?.paidAt || receipt?.paidAt)}</Descriptions.Item>
              <Descriptions.Item label="Способ">{receipt?.paymentMethodLabel || order.payment?.paymentMethodType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Карта">{order.payment?.cardMask || receipt?.cardMask || '—'}</Descriptions.Item>
              <Descriptions.Item label="Платёж в банке">{order.payment?.yookassaPaymentId || receipt?.bankPaymentId || '—'}</Descriptions.Item>
              {(order.payment?.receiptUrl || receipt?.receiptUrl) && (
                <Descriptions.Item label="Чек">
                  <Link href={order.payment?.receiptUrl || receipt?.receiptUrl || undefined} target="_blank">
                    Открыть чек
                  </Link>
                </Descriptions.Item>
              )}
              {order.priceConfirmedAt && (
                <Descriptions.Item label="Цену подтвердил">
                  {order.priceConfirmedBy?.name || 'Сотрудник'} · {formatDate(order.priceConfirmedAt)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="Состав" style={{ marginTop: 16 }}>
        <Table rowKey="id" size="small" pagination={false} columns={itemColumns} dataSource={order.items ?? []} scroll={{ x: 640 }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="Исполнитель"
            extra={order.assignedTo ? roleLabel(order.assignedTo.processingRole) : undefined}
          >
            {order.assignedTo ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Имя">{order.assignedTo.name}</Descriptions.Item>
                <Descriptions.Item label="Должность">{order.assignedTo.position || '—'}</Descriptions.Item>
                <Descriptions.Item label="Телефон">{order.assignedTo.phone || '—'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">Заказ сейчас ни на кого не назначен</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Движение по сотрудникам">
            {history.length === 0 ? (
              <Text type="secondary">История статусов пуста</Text>
            ) : (
              <Timeline
                items={history.map((entry) => {
                  const parsed = parseHistoryComment(entry.comment);
                  return {
                    children: (
                      <div>
                        <Text strong>{ORDER_STATUS_LABELS[entry.status as OrderStatus] ?? entry.status}</Text>
                        <div><Text type="secondary">{formatDate(entry.createdAt)}</Text></div>
                        {parsed.text && <div>{parsed.text}</div>}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </Card>
        </Col>
      </Row>

      {(order.orderLogs?.length ?? 0) > 0 && (
        <Card title="Журнал действий" style={{ marginTop: 16 }}>
          <Timeline
            items={order.orderLogs.map((log) => ({
              children: (
                <div>
                  <Text strong>{ORDER_LOG_LABELS[log.action] ?? log.action}</Text>
                  <div><Text type="secondary">{formatDate(log.createdAt)} · {log.user?.email || 'система'}</Text></div>
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {(order.clientChoices?.length ?? 0) > 0 && (
        <Card title="Предложения клиенту" style={{ marginTop: 16 }}>
          {order.clientChoices.map((choice) => (
            <div key={choice.id} style={{ marginBottom: 8 }}>
              <Text strong>{choice.title}</Text>
              <div>
                <Tag>{CHOICE_TYPE_LABELS[choice.choiceType] ?? choice.choiceType}</Tag>
                <Tag>{CHOICE_STATUS_LABELS[choice.status] ?? choice.status}</Tag>
                <Text type="secondary">
                  {formatDate(choice.createdAt)}
                  {choice.expiresAt ? ` · до ${formatDate(choice.expiresAt)}` : ''}
                </Text>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal
        title="Назначить сотрудника"
        open={assignOpen}
        okText="Назначить"
        confirmLoading={assignMutation.isPending}
        onCancel={() => setAssignOpen(false)}
        onOk={() => {
          if (!assigneeId) {
            message.warning('Выберите сотрудника');
            return;
          }
          assignMutation.mutate({
            assignedToId: assigneeId,
            reason: assignReason.trim() || undefined,
          });
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {!warehouseId && <Alert type="warning" showIcon message="У заказа нет склада, назначить сотрудника нельзя" />}
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Сотрудник склада"
            style={{ width: '100%' }}
            loading={workloadQuery.isLoading}
            value={assigneeId ?? undefined}
            onChange={(value) => setAssigneeId(value)}
            options={assignees.map((employee) => ({
              value: employee.id,
              label: `${employee.name}${roleLabel(employee.processingRole) ? ` · ${roleLabel(employee.processingRole)}` : ''} · заказов ${employee.activeOrdersCount}`,
            }))}
          />
          <Input
            placeholder="Причина"
            maxLength={200}
            value={assignReason}
            onChange={(event) => setAssignReason(event.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        title="Отменить заказ"
        open={cancelOpen}
        okText="Отменить заказ"
        okButtonProps={{ danger: true, disabled: cancelReason.trim().length < 10 }}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelMutation.mutate()}
      >
        <Input.TextArea
          rows={4}
          maxLength={500}
          placeholder="Причина, не короче 10 символов"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </div>
  );
}
