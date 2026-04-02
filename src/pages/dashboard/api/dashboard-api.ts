import { apiClient } from '@/shared/api';

export interface CriticalStockItem {
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  districtName: string;
  currentQuantity: number;
  threshold: number;
  urgency: 'critical' | 'warning' | 'attention' | 'normal';
  salesRate: number;
  isFastMoving: boolean;
  imageUrl: string | null;
}

export interface WarehouseItem {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
  maintenanceMode: boolean;
  district: { id: number; name: string };
  _count: { productStocks: number; orders: number };
}

export async function getCriticalStock(limit = 15): Promise<CriticalStockItem[]> {
  const { data } = await apiClient.get<{ data?: { items?: CriticalStockItem[] } }>(
    '/api/stock-alerts/critical',
    { params: { limit } },
  );
  return data.data?.items ?? [];
}

export async function getWarehousesList(): Promise<WarehouseItem[]> {
  const { data } = await apiClient.get<{ data?: { warehouses?: WarehouseItem[] } }>(
    '/api/warehouses',
    { params: { limit: 100 } },
  );
  return data.data?.warehouses ?? [];
}
