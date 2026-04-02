import { apiClient } from '@/shared/api';
import type { District } from '../model/types';

interface DistrictsResponse {
  status?: string;
  data?: District[];
}

/** Список районов. Бэкенд: GET /api/districts (без авторизации). */
export async function getDistricts(): Promise<District[]> {
  const { data } = await apiClient.get<DistrictsResponse>('/api/districts');
  return data?.data ?? [];
}
