import { env } from '@/shared/config';

/**
 * Строит полный URL изображения.
 *
 * Порядок разрешения:
 * 1. Если url уже абсолютный (http/https) — возвращаем как есть.
 * 2. Если задан VITE_UPLOADS_BASE_URL (прямой S3/CDN) — используем его:
 *    `{UPLOADS_BASE_URL}/{path}` (strip leading "uploads/" если есть).
 * 3. Иначе — проксируем через API-сервер по пути `/uploads/{path}`.
 */
export function buildImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Нормализуем путь: убираем ведущий слэш и префикс "uploads/"
  const normalized = trimmed.replace(/^\/+/, '').replace(/^uploads\//, '');

  const uploadsBase = (env.UPLOADS_BASE_URL || '').replace(/\/+$/, '');
  if (uploadsBase) {
    return `${uploadsBase}/${normalized}`;
  }

  const apiBase = (env.API_BASE_URL || '').replace(/\/+$/, '');
  if (!apiBase) return trimmed;
  return `${apiBase}/uploads/${normalized}`;
}

/**
 * Путь хранения в БД (как на сервере `normalizeImagePath`): `products/filename.jpg` или без префикса.
 * Нужен для `removeImages` — полные URL (VK Cloud, S3, API) приводятся к тому же виду, что в `product.images`.
 */
export function imageUrlToStoragePath(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      let pathname = u.pathname || '';
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        // ignore
      }

      const uploadsMatch = pathname.match(/\/uploads\/(.+)$/);
      if (uploadsMatch?.[1]) {
        return uploadsMatch[1].replace(/^\/+/, '');
      }

      const icebergMatch = pathname.match(/\/iceberg-uploads\/(.+)$/);
      if (icebergMatch?.[1]) {
        return icebergMatch[1].replace(/^\/+/, '');
      }

      const productsMatch = pathname.match(/\/products\/([^/]+)$/);
      if (productsMatch?.[1]) {
        return `products/${productsMatch[1]}`;
      }

      const parts = pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return `products/${last}`;
      return '';
    } catch {
      return trimmed;
    }
  }

  let p = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  if (p.startsWith('uploads/')) p = p.slice('uploads/'.length);
  return p;
}
