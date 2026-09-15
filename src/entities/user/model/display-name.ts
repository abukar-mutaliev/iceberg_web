import type { AdminUserProfile, UserRole } from './types';

/** Заглушка имени клиента до онбординга — как `UserService.PLACEHOLDER_CLIENT_NAME`. */
export const PLACEHOLDER_CLIENT_NAME = 'Новый клиент';

/** Подпись в админке вместо заглушки онбординга. */
export const INCOMPLETE_PROFILE_DISPLAY_NAME = 'Профиль не заполнен';

/** Историческая заглушка обязательного поля профиля, номером не является. */
export const UNSPECIFIED_CONTACT = 'Не указано';

export const FALLBACK_DISPLAY_NAME = 'Без имени';

export function isIncompleteClientName(name: string | null | undefined): boolean {
  return name === PLACEHOLDER_CLIENT_NAME || name === INCOMPLETE_PROFILE_DISPLAY_NAME;
}

/**
 * Имя клиента для списков: заглушка онбординга не должна выглядеть как ФИО.
 * Порт `UserService.getClientDisplayName`.
 */
export function getClientDisplayName(
  name: string | null | undefined,
  profileCompletedAt: string | Date | null | undefined,
): string | null {
  if (!profileCompletedAt && name === PLACEHOLDER_CLIENT_NAME) {
    return INCOMPLETE_PROFILE_DISPLAY_NAME;
  }

  return name || null;
}

export function normalizeContactPhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const trimmed = phone.trim();
  if (!trimmed || trimmed === UNSPECIFIED_CONTACT) return null;
  return trimmed;
}

/** Плоский вариант для адаптеров API, пока union профиля ещё не собран. */
export function resolveDisplayName(params: {
  role: UserRole;
  email?: string | null;
  profileCompletedAt?: string | Date | null;
  name?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
}): string {
  if (params.role === 'CLIENT') {
    return (
      getClientDisplayName(params.name, params.profileCompletedAt)
      || params.email?.trim()
      || FALLBACK_DISPLAY_NAME
    );
  }

  return (
    params.companyName?.trim()
    || params.contactPerson?.trim()
    || params.name?.trim()
    || params.email?.trim()
    || FALLBACK_DISPLAY_NAME
  );
}

export function getUserDisplayName(input: {
  role: UserRole;
  email?: string | null;
  profileCompletedAt?: string | Date | null;
  profile?: AdminUserProfile | null;
}): string {
  const { role, email, profileCompletedAt, profile } = input;

  if (!profile || profile.kind === 'UNKNOWN') {
    return resolveDisplayName({ role, email, profileCompletedAt });
  }

  switch (profile.kind) {
    case 'CLIENT':
      return resolveDisplayName({
        role,
        email,
        profileCompletedAt,
        name: profile.data.name,
      });
    case 'EMPLOYEE':
      return resolveDisplayName({ role, email, name: profile.data.name });
    case 'ADMIN':
      return resolveDisplayName({ role, email, name: profile.data.name });
    case 'DRIVER':
      return resolveDisplayName({ role, email, name: profile.data.name });
    case 'SUPPLIER':
      return resolveDisplayName({
        role,
        email,
        companyName: profile.data.companyName,
        contactPerson: profile.data.contactPerson,
      });
  }
}
