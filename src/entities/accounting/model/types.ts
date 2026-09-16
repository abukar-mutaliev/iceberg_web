export type AccountingProfile = 'OPERATOR' | 'FINANCIER' | 'FULL';

export interface AccountingPeriodInfo {
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface AccountingSummary {
  period: AccountingPeriodInfo;
  revenue: {
    gross: number;
    returns: number;
    net: number;
    byType: { ORDER: number; STOP: number; DIRECT: number };
  };
  deliveryRevenue: number;
  cogs?: { total: number; actual: number; estimated: number };
  grossProfit?: number;
  grossMargin?: number | null;
  payments: { completed: number; refunded: number; net: number };
  paymentDifference: number;
  boxesSold: number;
  ordersDelivered: number;
  supplies: { receivedCount: number; spend?: number };
  rewardsPaid: number;
  writeOffValue?: number;
  returnsValue: number;
  byDay: Array<{ date: string; revenue: number; cogs?: number; profit?: number; boxesSold: number }>;
  control: {
    salesWithoutPayment: number;
    salesWithoutCost: number;
    estimatedCostSales: number;
    negativeStocks: number;
    openDrafts: number;
  };
}

export interface AccountingSaleRow {
  id: number;
  warehouseId: number;
  warehouseName?: string;
  productId: number;
  productName?: string;
  quantity: number;
  returnedQty: number;
  netQty: number;
  salePriceAtSale: number;
  costAtSale?: number;
  profitAtSale?: number;
  isEstimatedCost: boolean;
  revenue: number;
  returnsAmount: number;
  netRevenue: number;
  saleType: 'ORDER' | 'STOP' | 'DIRECT';
  soldAt: string;
  orderId: number | null;
  orderNumber: string | null;
  stopId: number | null;
  clientName: string | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface SupplyDocumentLine {
  id: number;
  productId: number;
  quantity: number;
  unitCost: number | null;
  reversedQty: number;
  barcodeScanned?: string | null;
  product?: { id: number; name: string; barcode?: string | null };
}

export interface SupplyDocument {
  id: number;
  number: string;
  supplierId: number;
  warehouseId: number;
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED' | 'REVERSED' | 'PARTIALLY_REVERSED';
  documentDate: string;
  comment?: string | null;
  totalAmount: number;
  isLateEntry: boolean;
  lines: SupplyDocumentLine[];
  supplier?: { id: number; companyName: string };
  warehouse?: { id: number; name: string };
}

export interface InventoryCount {
  id: number;
  warehouseId: number;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  documentDate: string;
  comment?: string | null;
  lines: Array<{
    id: number;
    productId: number;
    expectedQuantity: number;
    actualQuantity: number;
    reason?: string | null;
    product?: { id: number; name: string };
  }>;
  warehouse?: { id: number; name: string };
}

export interface AccountingControl {
  negativeStocks: number;
  quantityBelowReserved: number;
  estimatedCostSales?: number;
  suppliesWithoutCost?: number;
  staleDrafts: number;
  closedPeriods: number;
  illegalSupplyReturnHistory: number;
}

export interface AuditLogRow {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  reason?: string | null;
  createdAt: string;
  user?: { id: number; email: string | null; role: string } | null;
}

export interface ProductLedger {
  product: { id: number; name: string; sku?: string | null; barcode?: string | null };
  stocks: Array<{ warehouseId: number; warehouseName?: string; quantity: number; reserved: number; warehousePrice?: number | null }>;
  sales: AccountingSaleRow[];
  supplies: unknown[];
  movements: unknown[];
}

export interface PeriodQuery {
  period?: 'day' | 'week' | 'month' | 'year';
  date?: string;
  startDate?: string;
  endDate?: string;
  warehouseId?: number;
  page?: number;
  limit?: number;
}
