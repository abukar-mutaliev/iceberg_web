import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config';
import { tokenStorage } from './token-storage';

const BASE_URL = env.API_BASE_URL;

/**
 * Базовый HTTP-клиент с подстановкой Bearer и обработкой 401 (refresh).
 * Один refresh на поколение сессии. Ответ старого refresh не перезаписывает
 * токены, если за это время вышли или вошли другим аккаунтом.
 */
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;
let refreshEpoch = -1;

function readBearer(config: InternalAxiosRequestConfig): string | null {
  const headers = config.headers as { Authorization?: unknown; get?: (name: string) => unknown };
  const raw = headers.get?.('Authorization') ?? headers.Authorization;
  if (typeof raw !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1] ?? null;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.href = '/login';
}

async function refreshTokens(): Promise<string | null> {
  const epoch = tokenStorage.currentEpoch();
  if (refreshPromise && refreshEpoch === epoch) return refreshPromise;

  const refresh = tokenStorage.getRefreshToken();
  if (!refresh || !tokenStorage.isCurrent(epoch)) return null;

  refreshEpoch = epoch;
  const promise = (async () => {
    try {
      const { data } = await axios.post<{ data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string }>(
        `${BASE_URL}/api/auth/refresh-token`,
        { refreshToken: refresh }
      );
      if (!tokenStorage.isCurrent(epoch)) return null;

      const payload = (data?.data ?? data) as { accessToken?: string; refreshToken?: string };
      const newAccess = payload?.accessToken;
      const newRefresh = payload?.refreshToken;
      if (!newAccess) {
        tokenStorage.discardIfCurrent(epoch);
        return null;
      }

      const saved = tokenStorage.writeIfCurrent(epoch, newAccess, newRefresh ?? refresh);
      return saved ? newAccess : null;
    } catch {
      tokenStorage.discardIfCurrent(epoch);
      return null;
    } finally {
      if (refreshEpoch === epoch) refreshPromise = null;
    }
  })();

  refreshPromise = promise;
  return promise;
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
  const axiosError = error as { response?: { status: number }; config?: RetryConfig };
  const config = axiosError.config;
  if (axiosError.response?.status !== 401 || !config) {
    return Promise.reject(error);
  }

  const sentToken = readBearer(config);
  const currentToken = tokenStorage.getAccessToken();

  // Ответ от запроса прошлого аккаунта. Не повторяем его и не трогаем новую сессию.
  if (!sentToken || sentToken !== currentToken) {
    return Promise.reject(error);
  }

  if (config._retry) {
    tokenStorage.endSession();
    redirectToLogin();
    return Promise.reject(error);
  }

  const epoch = tokenStorage.currentEpoch();
  const newAccess = await refreshTokens();
  if (newAccess && tokenStorage.isCurrent(epoch)) {
    config._retry = true;
    config.headers.Authorization = `Bearer ${newAccess}`;
    return axios.request(config);
  }

  if (tokenStorage.getAccessToken()) {
    return Promise.reject(error);
  }

  redirectToLogin();
  return Promise.reject(error);
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
