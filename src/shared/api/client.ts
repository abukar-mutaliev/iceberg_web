import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config';
import { tokenStorage } from './token-storage';

const BASE_URL = env.API_BASE_URL;

/**
 * Базовый HTTP-клиент с подстановкой Bearer и обработкой 401 (refresh).
 * Очередь запросов во время refresh — один одновременный refresh.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshTokens(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<{ data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string }>(
        `${BASE_URL}/api/auth/refresh-token`,
        { refreshToken: refresh }
      );
      const payload = (data?.data ?? data) as { accessToken?: string; refreshToken?: string };
      const newAccess = payload?.accessToken;
      const newRefresh = payload?.refreshToken;
      if (newAccess) {
        tokenStorage.setTokens(newAccess, newRefresh ?? refresh);
        return newAccess;
      }
      return null;
    } catch {
      tokenStorage.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function onRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData: не задавать Content-Type — браузер сам установит multipart/form-data с boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}

async function onResponseError(error: unknown): Promise<unknown> {
  const axiosError = error as { response?: { status: number }; config?: InternalAxiosRequestConfig };
  if (axiosError.response?.status !== 401) {
    return Promise.reject(error);
  }
  const newAccess = await refreshTokens();
  if (!newAccess || !axiosError.config) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
  axiosError.config.headers.Authorization = `Bearer ${newAccess}`;
  return axios.request(axiosError.config);
}

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });
  client.interceptors.request.use(onRequest);
  client.interceptors.response.use((r) => r, onResponseError);
  return client;
}

export const apiClient = createApiClient();
