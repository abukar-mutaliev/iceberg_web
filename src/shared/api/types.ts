/**
 * Общие типы ответов API.
 */
export interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasMore?: boolean;
}
