export interface WorkingHours {
  id: number;
  warehouseId: number;
  dayOfWeek: number; // 0=Sun, 1=Mon … 6=Sat
  isOpen: boolean;
  openTime: string | null;  // "HH:mm"
  closeTime: string | null;
}

export interface WarehouseEmployee {
  id: number;
  name: string;
  position?: string | null;
  phone?: string | null;
  user: {
    id: number;
    email: string | null;
    avatar: string | null;
    phone: string | null;
  } | null;
}

export interface WarehouseProductStock {
  id: number;
  productId: number;
  quantity: number;
  reserved: number;
  warehousePrice: number | null;
  product: {
    id: number;
    name: string;
    price: number;
    stockQuantity: number;
    images: string[];
  };
}

export interface WarehouseDistrict {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  districtId: number;
  district: WarehouseDistrict;
  latitude: number | null;
  longitude: number | null;
  maxDeliveryRadius: number | null;
  isMain: boolean;
  isActive: boolean;
  maintenanceMode: boolean;
  maintenanceReason: string | null;
  autoManageStatus: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  workingHours: WorkingHours[];
  employees: WarehouseEmployee[];
  productStocks: WarehouseProductStock[];
  _count: { orders: number };
}

/** Краткая карточка для списков */
export interface WarehouseSummary {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
  maintenanceMode: boolean;
  isMain: boolean;
  district: WarehouseDistrict;
  _count: { productStocks: number; orders: number };
}
