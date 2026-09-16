import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type {
  AccountingControl,
  AccountingSaleRow,
  AccountingSummary,
  AuditLogRow,
  InventoryCount,
  Paginated,
  PeriodQuery,
  ProductLedger,
  SupplyDocument,
} from '../model/types';

function unwrap<T>(payload: ApiResponse<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
}

export async function getAccountingSummary(params: PeriodQuery): Promise<AccountingSummary> {
  const { data } = await apiClient.get<ApiResponse<AccountingSummary>>('/api/accounting/summary', { params });
  return unwrap(data);
}

export async function getAccountingSales(
  params: PeriodQuery & { saleType?: string },
): Promise<Paginated<AccountingSaleRow> & { totals: Record<string, number> }> {
  const { data } = await apiClient.get('/api/accounting/sales', { params });
  return unwrap(data);
}

export async function getWarehouseComparison(params: PeriodQuery) {
  const { data } = await apiClient.get('/api/accounting/warehouses/comparison', { params });
  return unwrap(data) as Array<Record<string, unknown>>;
}

export async function getStockHistory(params: PeriodQuery) {
  const { data } = await apiClient.get('/api/accounting/stock-history', { params });
  return unwrap(data) as Paginated<Record<string, unknown>>;
}

export async function getAccountingControl(): Promise<AccountingControl> {
  const { data } = await apiClient.get<ApiResponse<AccountingControl>>('/api/accounting/control');
  return unwrap(data);
}

export async function getAccountingAudit(params: { page?: number }): Promise<Paginated<AuditLogRow>> {
  const { data } = await apiClient.get('/api/accounting/audit', { params });
  return unwrap(data);
}

export async function getProductLedger(productId: number, params?: PeriodQuery): Promise<ProductLedger> {
  const { data } = await apiClient.get(`/api/accounting/products/${productId}/ledger`, { params });
  return unwrap(data);
}

export async function exportAccounting(params: PeriodQuery & { format: 'csv' | 'xlsx' }) {
  const { data } = await apiClient.get('/api/accounting/export', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function getSupplies(params: Record<string, unknown> = {}): Promise<Paginated<SupplyDocument>> {
  const { data } = await apiClient.get('/api/accounting/supplies', { params });
  return unwrap(data);
}

export async function getSupply(id: number): Promise<SupplyDocument> {
  const { data } = await apiClient.get(`/api/accounting/supplies/${id}`);
  return unwrap(data);
}

export async function createSupply(payload: Record<string, unknown>): Promise<SupplyDocument> {
  const { data } = await apiClient.post('/api/accounting/supplies', payload);
  return unwrap(data);
}

export async function updateSupply(id: number, payload: Record<string, unknown>): Promise<SupplyDocument> {
  const { data } = await apiClient.patch(`/api/accounting/supplies/${id}`, payload);
  return unwrap(data);
}

export async function receiveSupply(id: number, idempotencyKey: string, payload: Record<string, unknown> = {}): Promise<SupplyDocument> {
  const { data } = await apiClient.post(`/api/accounting/supplies/${id}/receive`, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return unwrap(data);
}

export async function cancelSupply(id: number, idempotencyKey: string): Promise<SupplyDocument> {
  const { data } = await apiClient.post(`/api/accounting/supplies/${id}/cancel`, {}, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return unwrap(data);
}

export async function reverseSupply(id: number, idempotencyKey: string, payload: Record<string, unknown>): Promise<SupplyDocument> {
  const { data } = await apiClient.post(`/api/accounting/supplies/${id}/reverse`, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return unwrap(data);
}

export async function lookupBarcode(code: string) {
  const { data } = await apiClient.get('/api/accounting/products/by-barcode', { params: { code } });
  return unwrap(data) as { id: number; name: string; barcode: string; supplierId: number | null };
}

export async function getInventoryCounts(params: Record<string, unknown> = {}): Promise<Paginated<InventoryCount>> {
  const { data } = await apiClient.get('/api/accounting/inventory', { params });
  return unwrap(data);
}

export async function getInventoryCount(id: number): Promise<InventoryCount> {
  const { data } = await apiClient.get(`/api/accounting/inventory/${id}`);
  return unwrap(data);
}

export async function createInventoryCount(payload: Record<string, unknown>): Promise<InventoryCount> {
  const { data } = await apiClient.post('/api/accounting/inventory', payload);
  return unwrap(data);
}

export async function completeInventoryCount(id: number, idempotencyKey: string, payload: Record<string, unknown> = {}): Promise<InventoryCount> {
  const { data } = await apiClient.post(`/api/accounting/inventory/${id}/complete`, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return unwrap(data);
}

export async function cancelInventoryCount(id: number): Promise<InventoryCount> {
  const { data } = await apiClient.post(`/api/accounting/inventory/${id}/cancel`);
  return unwrap(data);
}
