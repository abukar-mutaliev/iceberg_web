export interface FeedbackProduct {
  id: number;
  name: string;
  supplier?: {
    id: number;
    companyName: string;
  };
}

export interface FeedbackUser {
  id: number;
  email: string | null;
  avatar: string | null;
}

export interface FeedbackClient {
  id: number;
  name: string | null;
}

export interface Feedback {
  id: number;
  productId: number;
  product?: FeedbackProduct;
  productName?: string;
  userId: number;
  user?: FeedbackUser;
  client?: FeedbackClient;
  rating: number;
  comment: string | null;
  supplierReply: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FeedbacksListParams {
  page?: number;
  limit?: number;
  productId?: number;
}

export interface FeedbacksListResponse {
  data: Feedback[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasMore?: boolean;
  };
}
