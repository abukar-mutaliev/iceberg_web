/**
 * Токены лежат в sessionStorage и переживают обновление страницы.
 * Смена аккаунта увеличивает поколение сессии: ответ старого refresh
 * уже не может записать токены предыдущего пользователя поверх новых.
 */
const ACCESS_KEY = 'iceberg_supplier_access';
const REFRESH_KEY = 'iceberg_supplier_refresh';

let sessionEpoch = 0;
const sessionListeners = new Set<() => void>();

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

function notifySessionChange(): void {
  sessionListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // слушатель кэша не должен срывать смену сессии
    }
  });
}

function endSession(): void {
  sessionEpoch += 1;
  const hadSession = Boolean(safeGet(ACCESS_KEY) || safeGet(REFRESH_KEY));
  safeRemove(ACCESS_KEY);
  safeRemove(REFRESH_KEY);
  if (hadSession) notifySessionChange();
}

export const tokenStorage = {
  currentEpoch(): number {
    return sessionEpoch;
  },

  isCurrent(epoch: number): boolean {
    return epoch === sessionEpoch;
  },

  onSessionChange(listener: () => void): () => void {
    sessionListeners.add(listener);
    return () => {
      sessionListeners.delete(listener);
    };
  },

  /** Новая сессия. Старый refresh больше не имеет права писать токены. */
  replaceSession(access: string, refresh: string): void {
    sessionEpoch += 1;
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
    notifySessionChange();
  },

  /** Запись пары токенов только если это всё ещё та же сессия, которая начала refresh. */
  writeIfCurrent(epoch: number, access: string, refresh: string): boolean {
    if (epoch !== sessionEpoch) return false;
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
    return true;
  },

  /** Сбросить сессию, только если за время refresh пользователь не вошёл заново. */
  discardIfCurrent(epoch: number): void {
    if (epoch !== sessionEpoch) return;
    endSession();
  },

  setTokens(access: string, refresh: string) {
    this.replaceSession(access, refresh);
  },

  getAccessToken(): string | null {
    return safeGet(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return safeGet(REFRESH_KEY);
  },

  endSession,

  clear() {
    endSession();
  },
};
