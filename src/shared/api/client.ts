import axios, { CanceledError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config';
import { tokenStorage } from './token-storage';

const BASE_URL = env.API_BASE_URL;

/**
 * Базовый HTTP-клиент с подстановкой Bearer и обработкой 401 (refresh).
 * Запрос запоминает поколение сессии. Ответ прошлого аккаунта не попадает
 * в панель, даже если он пришёл уже после нового входа.
 */
type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  sessionEpoch?: number;
};

let refreshPromise: Promise<string | null> | null = null;
let refreshEpoch = -1;
const inflight = new Set<AbortController>();

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

function isCurrentRequest(config: RetryConfig | undefined): boolean {
  return config?.sessionEpoch === undefined || tokenStorage.isCurrent(config.sessionEpoch);
}

function abortInflight(): void {
  inflight.forEach((controller) => controller.abort());
  inflight.clear();
}

tokenStorage.onSessionChange(abortInflight);

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
      // Пока ждали ответ, успели выйти или войти другим аккаунтом.
      if (!tokenStorage.isCurrent(epoch) || tokenStorage.getRefreshToken() !== refresh) return null;

      const payload = (data?.data ?? data) as { accessToken?: string; refreshToken?: string };
      const newAccess = payload?.accessToken;
      const newRefresh = payload?.refreshToken;
      if (!newAccess) {
        tokenStorage.discardIfCurrent(epoch);
        return null;
      }

      if (tokenStorage.getRefreshToken() !== refresh) return null;
      const saved = tokenStorage.writeIfCurrent(epoch, newAccess, newRefresh ?? refresh);
      return saved ? newAccess : null;
    } catch {
      if (tokenStorage.isCurrent(epoch) && tokenStorage.getRefreshToken() === refresh) {
        tokenStorage.discardIfCurrent(epoch);
      }
      return null;
    } finally {
      if (refreshEpoch === epoch) refreshPromise = null;
    }
  })();

  refreshPromise = promise;
  return promise;
}

function onRequest(config: RetryConfig): RetryConfig {
  const epoch = tokenStorage.currentEpoch();
  config.sessionEpoch = epoch;

  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (typeof config.headers.delete === 'function') {
    config.headers.delete('Authorization');
  } else {
    delete config.headers.Authorization;
  }

  const controller = new AbortController();
  config.signal = controller.signal;
  inflight.add(controller);
  controller.signal.addEventListener('abort', () => inflight.delete(controller), { once: true });

  // FormData: не задавать Content-Type — браузер сам установит multipart/form-data с boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}

function onResponse(response: AxiosResponse): AxiosResponse {
  const config = response.config as RetryConfig;
  if (!isCurrentRequest(config)) {
    throw new CanceledError('stale session');
  }
  return response;
}

async function onResponseError(error: unknown, client: AxiosInstance): Promise<unknown> {
  const axiosError = error as { response?: { status: number }; config?: RetryConfig };
  const config = axiosError.config;
  if (axiosError.response?.status !== 401 || !config || !isCurrentRequest(config)) {
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
  if (newAccess && tokenStorage.isCurrent(epoch) && config.sessionEpoch === epoch) {
    config._retry = true;
    config.headers.Authorization = `Bearer ${newAccess}`;
    return client.request(config);
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
    // Иначе браузер может отдать GET прошлого аккаунта по тому же URL.
    adapter: 'fetch',
    fetchOptions: { cache: 'no-store' },
  });
  client.interceptors.request.use(onRequest);
  client.interceptors.response.use(onResponse, (error) => onResponseError(error, client));
  return client;
}

export const apiClient = createApiClient();
