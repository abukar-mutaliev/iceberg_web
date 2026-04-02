/**
 * Хранение токенов: access и refresh в sessionStorage для сохранения при обновлении страницы.
 * Очистка при выходе или при неудачном refresh.
 */
const ACCESS_KEY = 'iceberg_supplier_access';
const REFRESH_KEY = 'iceberg_supplier_refresh';

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const tokenStorage = {
  setTokens(access: string, refresh: string) {
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
  },

  getAccessToken(): string | null {
    return safeGet(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return safeGet(REFRESH_KEY);
  },

  clear() {
    safeRemove(ACCESS_KEY);
    safeRemove(REFRESH_KEY);
  },
};
