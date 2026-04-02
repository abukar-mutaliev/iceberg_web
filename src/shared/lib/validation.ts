/** Проверка: строка — валидный email (устойчиво к null/автозаполнению) */
export function isEmail(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  return /\S+@\S+\.\S+/.test(value.trim());
}

/** Проверка: строка — номер телефона. Принимаем 89289203006, +79289203006, 7 928 920 30 06 и т.п. */
export function isPhone(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  // Только цифры (после удаления +, пробелов, дефисов, скобок) — от 10 до 12 символов, начало 7 или 8
  const digits = trimmed.replace(/[\s\-()]+/g, '').replace(/^\+/, '');
  if (!/^\d{10,12}$/.test(digits)) return false;
  const first = digits[0];
  return first === '8' || first === '7';
}

/** Email или телефон (для поля «Email или номер телефона»), устойчиво к null */
export function isEmailOrPhone(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const v = value.trim();
  return v.length > 0 && (isEmail(v) || isPhone(v));
}

/** Формат номера РФ для СМС-входа: 89289203006, +79289203006, с пробелами/дефисами */
export const PHONE_RU_REGEX = /^[\s\-()]*(\+7|8|7)[\s\-()]*\d[\d\s\-()]{8,10}$/;
export function isPhoneRu(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  const digits = trimmed.replace(/[\s\-()]+/g, '').replace(/^\+/, '');
  return /^\d{10}$/.test(digits) || /^[78]\d{9,11}$/.test(digits);
}
