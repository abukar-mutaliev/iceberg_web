const WEIGHT_CATEGORY_NAMES = new Set(['рыба', 'fish']);

type WeightCategory = {
  name?: string | null;
  description?: string | null;
  isWeightBased?: boolean;
};

type WeightProduct = {
  isWeightBased?: boolean;
  categories?: WeightCategory[] | null;
  boxInfo?: { isWeightBased?: boolean; quantityUnit?: string } | null;
};

export function categoryIsWeightBased(category?: WeightCategory | null): boolean {
  if (!category) return false;
  if (category.isWeightBased === true) return true;
  const name = String(category.name || '').toLowerCase().trim();
  const description = String(category.description || '').toLowerCase().trim();
  return WEIGHT_CATEGORY_NAMES.has(name) || WEIGHT_CATEGORY_NAMES.has(description);
}

/** Рыба: price — за 1 кг, itemsPerBox — килограммы в коробке. */
export function isWeightBasedProduct(product?: WeightProduct | null): boolean {
  if (!product) return false;
  if (product.isWeightBased === true) return true;
  if (product.boxInfo?.isWeightBased === true || product.boxInfo?.quantityUnit === 'kg') return true;
  return (product.categories ?? []).some(categoryIsWeightBased);
}

export function categoriesSelectionIsWeightBased(
  categories: Array<WeightCategory & { id: number }>,
  selectedIds: number[] | undefined,
): boolean {
  const selected = new Set(selectedIds ?? []);
  return categories.some((category) => selected.has(category.id) && categoryIsWeightBased(category));
}

export function weightBasedBoxPrice(pricePerKg: number, kgPerBox: number): number {
  const kg = kgPerBox > 0 ? kgPerBox : 1;
  return Math.round(pricePerKg * kg * 100) / 100;
}
