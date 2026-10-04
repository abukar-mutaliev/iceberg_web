import type { Product } from './types';
import { isWeightBasedProduct, weightBasedBoxPrice } from './weight-based';

/**
 * Цены для отображения в UI.
 * Поставщик до модерации видит предложенные значения (supplierProposed*), остальные роли — утверждённые price/boxPrice.
 * Рыба: коробка = цена за кг × кг в коробке, сохранённая boxPrice не используется.
 */
export function getProductDisplayPrices(
  product: Product,
  options: { viewerRole?: string }
): { unitPrice: number; boxPrice: number } {
  const role = options.viewerRole;
  const itemsPerBox = product.itemsPerBox || 1;
  const fish = isWeightBasedProduct(product);

  if (role === 'SUPPLIER') {
    const unit = product.supplierProposedPrice ?? product.price;
    const box = fish
      ? weightBasedBoxPrice(unit, itemsPerBox)
      : (product.supplierProposedBoxPrice ??
        product.boxPrice ??
        product.boxInfo?.boxPrice ??
        unit * itemsPerBox);
    return { unitPrice: unit, boxPrice: box };
  }

  const unit = product.price;
  const box = fish
    ? weightBasedBoxPrice(unit, itemsPerBox)
    : (product.boxPrice ?? product.boxInfo?.boxPrice ?? unit * itemsPerBox);
  return { unitPrice: unit, boxPrice: box };
}
