export const accountingKeys = {
  all: ['accounting'] as const,
  summary: (filters: unknown) => [...accountingKeys.all, 'summary', filters] as const,
  sales: (filters: unknown) => [...accountingKeys.all, 'sales', filters] as const,
  warehouses: (filters: unknown) => [...accountingKeys.all, 'warehouses', filters] as const,
  movements: (filters: unknown) => [...accountingKeys.all, 'movements', filters] as const,
  control: () => [...accountingKeys.all, 'control'] as const,
  audit: (page: number) => [...accountingKeys.all, 'audit', page] as const,
  supplies: (filters: unknown) => [...accountingKeys.all, 'supplies', filters] as const,
  supply: (id: number) => [...accountingKeys.all, 'supply', id] as const,
  inventory: (filters: unknown) => [...accountingKeys.all, 'inventory', filters] as const,
  inventoryOne: (id: number) => [...accountingKeys.all, 'inventory-one', id] as const,
  ledger: (id: number) => [...accountingKeys.all, 'ledger', id] as const,
};
