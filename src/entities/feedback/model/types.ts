export interface FeedbackProduct {
  id: number;
  name: string;
}

export interface FeedbackUser {
  id: number;
  email: string | null;
  avatar: string | null;
}

export interface Feedback {
  id: number;
  productId: number;
  product?: FeedbackProduct;
  userId: number;
  user?: FeedbackUser;
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
