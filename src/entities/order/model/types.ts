export type OrderStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'WAITING_STOCK'
  | 'PICKING'
  | 'PACKING'
  | 'IN_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export interface OrderDistrict {
  id: number;
  name: string;
}

export interface OrderClientView {
  id: number;
  name: string;
  phone: string | null;
  email?: string | null;
  phoneMasked: boolean;
  district: OrderDistrict | null;
}

export interface OrderAssignee {
  id: number;
  name: string;
  position?: string | null;
  processingRole?: string | null;
  phone?: string | null;
}

export interface OrderWarehouseView {
  id: number;
  name: string;
  address?: string | null;
  district?: string | null;
}

export interface OrderPaymentView {
  id: number;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  paymentMethodType?: string | null;
  yookassaPaymentId?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  cardMask?: string | null;
  receiptUrl?: string | null;
  createdAt?: string | null;
}

export interface OrderProductView {
  id: number;
  name: string;
  images?: string[] | null;
  price?: number;
  weight?: number | null;
}

export interface OrderItemView {
  id: number;
  quantity: number;
  price: number;
  subtotal?: number;
  isWeightBased?: boolean;
  pricePerKg?: number | null;
  estimatedWeightKg?: number | null;
  actualWeightKg?: number | null;
  estimatedPrice?: number | null;
  product?: OrderProductView | null;
}

export interface OrderHistoryEntry {
  id: number;
  status: OrderStatus;
  comment: string | null;
  createdAt: string;
}

export interface OrderLogEntry {
  id: number;
  action: string;
  userId: number | null;
  data?: unknown;
  createdAt: string;
  user?: { id: number; email: string | null } | null;
}

export interface ClientChoice {
  id: number;
  choiceType: string;
  status: string;
  title: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface OrderListItem {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  statusLabel?: string;
  isUrgent?: boolean;
  isWeightBased?: boolean;
  totalAmount: number;
  deliveryFee?: number;
  deliveryType?: string | null;
  deliveryAddress?: string | null;
  createdAt: string;
  updatedAt?: string;
  client: OrderClientView | null;
  warehouse: OrderWarehouseView | null;
  assignedToId: number | null;
  assignedTo: OrderAssignee | null;
  payment: Pick<OrderPaymentView, 'id' | 'status' | 'amount' | 'paidAt'> | null;
  priceConfirmedAt?: string | null;
  pickingVerifiedAt?: string | null;
  pickingScanRequired?: boolean;
  pickingToken?: string | null;
}

export interface OrderDetail extends OrderListItem {
  comment: string | null;
  expectedDeliveryDate: string | null;
  waitingDeadline: string | null;
  estimatedAmount: number | null;
  isEstimatedPrice?: boolean;
  priceConfirmedBy: OrderAssignee | null;
  priceConfirmationComment: string | null;
  items: OrderItemView[];
  statusHistory: OrderHistoryEntry[];
  orderLogs: OrderLogEntry[];
  clientChoices: ClientChoice[];
  packingPhotoUrl: string | null;
  canCancel: boolean;
  cancelReason: string | null;
  payment: OrderPaymentView | null;
}

export interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface OrdersListResult {
  data: OrderListItem[];
  pagination: OrdersPagination;
}

export interface WorkloadEmployee {
  id: number;
  name: string;
  processingRole: string | null;
  activeOrdersCount: number;
}

export interface OrderReceiptView {
  hasPayment: boolean;
  isPaid: boolean;
  orderNumber: string;
  receipt: {
    amount?: number;
    status?: string;
    paymentMethodLabel?: string | null;
    cardMask?: string | null;
    paidAt?: string | null;
    receiptUrl?: string | null;
    bankPaymentId?: string | null;
    terminalName?: string | null;
  } | null;
}

export interface ConfirmPriceItemPayload {
  orderItemId: number;
  actualWeightKg?: number;
  pricePerKg?: number;
  remove?: boolean;
}

export interface ConfirmPricePayload {
  items: ConfirmPriceItemPayload[];
  deliveryFee?: number;
  comment?: string;
}
