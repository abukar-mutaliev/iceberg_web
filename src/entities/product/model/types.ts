export type ProductModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  slug?: string;
}

export interface ProductSupplier {
  id: number;
  companyName: string;
  contactPerson?: string;
}

export interface BoxInfo {
  itemsPerBox: number;
  boxPrice: number;
  pricePerItem: number;
  availableBoxes: number;
  totalItems: number;
  minimumOrder: number;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  boxPrice?: number | null;
  itemsPerBox: number;
  stockQuantity: number;
  images: string[];
  isActive: boolean;
  moderationStatus: ProductModerationStatus;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  supplierProposedPrice?: number | null;
  supplierProposedBoxPrice?: number | null;
  weight?: number | null;
  categories?: Category[];
  supplier?: ProductSupplier | null;
  boxInfo?: BoxInfo;
  totalItems?: number;
}

export interface ProductsListParams {
  page?: number;
  limit?: number;
  moderationStatus?: ProductModerationStatus;
}

export interface ProductsListResponse {
  data: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasMore?: boolean;
  };
}
