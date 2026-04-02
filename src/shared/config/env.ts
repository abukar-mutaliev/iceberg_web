/**
 * Переменные окружения (только VITE_* доступны на клиенте).
 */
export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  UPLOADS_BASE_URL: import.meta.env.VITE_UPLOADS_BASE_URL ?? '',
} as const;
