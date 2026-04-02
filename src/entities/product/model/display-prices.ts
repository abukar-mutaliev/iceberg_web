import type { Product } from './types';

/**
 * Цены для отображения в UI.
 * Поставщик до модерации видит предложенные значения (supplierProposed*), остальные роли — утверждённые price/boxPrice.
 */
export function getProductDisplayPrices(
  product: Product,
  options: { viewerRole?: string }
): { unitPrice: number; boxPrice: number } {
  const role = options.viewerRole;
  const itemsPerBox = product.itemsPerBox || 1;

  if (role === 'SUPPLIER') {
    const unit = product.supplierProposedPrice ?? product.price;
    const box =
      product.supplierProposedBoxPrice ??
      product.boxPrice ??
      product.boxInfo?.boxPrice ??
      unit * itemsPerBox;
    return { unitPrice: unit, boxPrice: box };
  }

  const unit = product.price;
  const box =
    product.boxPrice ??
    product.boxInfo?.boxPrice ??
    unit * itemsPerBox;
  return { unitPrice: unit, boxPrice: box };
}
