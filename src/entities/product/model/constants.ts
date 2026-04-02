import type { ProductModerationStatus } from './types';

export const MODERATION_STATUS_LABELS: Record<ProductModerationStatus, string> = {
  PENDING: 'На модерации',
  APPROVED: 'Одобрен',
  REJECTED: 'Отклонён',
};
