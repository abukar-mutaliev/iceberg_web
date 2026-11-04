import { apiClient } from '@/shared/api';

export interface AiChatLog {
  id: number;
  userId: number | null;
  userQuery: string;
  aiResponse: string;
  category: string | null;
  userIntent: string | null;
  confidenceScore: number | null;
  dataMissing: boolean;
  userFeedback: number;
  createdAt: string;
}

export type AiLogSortField = 'createdAt' | 'confidenceScore' | 'userId';

export interface AiChatLogsParams {
  page: number;
  category?: string;
  problematic?: boolean;
  sortBy?: AiLogSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface AiChatLogsResult {
  logs: AiChatLog[];
  categories: string[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export function isCriticalAiLog(log: Pick<AiChatLog, 'dataMissing' | 'confidenceScore'>): boolean {
  return log.dataMissing === true || (log.confidenceScore != null && log.confidenceScore < 3);
}

export async function getAiChatLogs(params: AiChatLogsParams): Promise<AiChatLogsResult> {
  const { data } = await apiClient.get<{
    status?: string;
    message?: string;
    data?: AiChatLogsResult;
  }>('/api/admin/ai-logs', {
    params: {
      page: params.page,
      category: params.category || undefined,
      problematic: params.problematic ? 'true' : undefined,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    },
  });

  if (data.status !== 'success' || !data.data) {
    throw new Error(data.message ?? 'Не удалось загрузить журнал ИИ');
  }

  return data.data;
}
