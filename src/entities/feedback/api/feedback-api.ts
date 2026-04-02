import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { Feedback, FeedbacksListResponse } from '../model/types';

/** Список отзывов по продуктам поставщика. */
export async function getFeedbacksBySupplierId(
  supplierId: number,
  params: { page?: number; limit?: number; productId?: number } = {}
): Promise<FeedbacksListResponse> {
  const { page = 1, limit = 10, productId } = params;
  const searchParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (productId) searchParams.set('productId', String(productId));
  const query = searchParams.toString();
  const { data } = await apiClient.get<{ status?: string; data?: Feedback[]; pagination?: FeedbacksListResponse['pagination'] }>(
    `/api/feedbacks/supplier/${supplierId}${query ? `?${query}` : ''}`
  );
  return {
    data: data.data ?? [],
    pagination: data.pagination ?? { currentPage: page, totalPages: 1, totalItems: 0 },
  };
}

/** Ответ поставщика на отзыв. */
export async function replyToFeedback(id: number, replyText: string): Promise<Feedback> {
  const { data } = await apiClient.put<ApiResponse<Feedback>>(`/api/feedbacks/${id}/reply`, { reply: replyText });
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Не удалось отправить ответ');
}
