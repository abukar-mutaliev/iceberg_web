import { z } from 'zod';

export const supplyDraftSchema = z.object({
  number: z.string().min(1, 'Укажите номер'),
  supplierId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  documentDate: z.string().min(1),
  comment: z.string().optional(),
  lines: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().optional().nullable(),
  })).min(1, 'Нужна хотя бы одна строка'),
});

export type SupplyDraftValues = z.infer<typeof supplyDraftSchema>;
