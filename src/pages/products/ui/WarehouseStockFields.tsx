import { InputNumber, Table, Tag, Typography } from 'antd';
import type { WarehouseLayoutItem, WarehouseSummary } from '@/entities/warehouse';

interface WarehouseStockFieldsProps {
  warehouses: WarehouseSummary[];
  value: WarehouseLayoutItem[];
  onChange: (next: WarehouseLayoutItem[]) => void;
  canSetWarehousePrice?: boolean;
  allowedWarehouseIds?: number[] | null;
  disabled?: boolean;
}

export function WarehouseStockFields({
  warehouses,
  value,
  onChange,
  canSetWarehousePrice = false,
  allowedWarehouseIds = null,
  disabled = false,
}: WarehouseStockFieldsProps) {
  const visible = allowedWarehouseIds?.length
    ? warehouses.filter((warehouse) => allowedWarehouseIds.includes(warehouse.id))
    : warehouses;

  const byId = new Map(value.map((item) => [item.warehouseId, item]));

  const rows = visible.map((warehouse) => {
    const current = byId.get(warehouse.id);
    return {
      ...warehouse,
      quantity: current?.quantity ?? 0,
      reserved: current?.reserved ?? 0,
      warehousePrice: current?.warehousePrice ?? null,
    };
  });

  const upsert = (warehouseId: number, patch: Partial<WarehouseLayoutItem>) => {
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    const current = byId.get(warehouseId);
    const reserved = current?.reserved ?? 0;
    const nextItem: WarehouseLayoutItem = {
      warehouseId,
      quantity: Math.max(patch.quantity ?? current?.quantity ?? 0, reserved),
      reserved,
      isMain: warehouse?.isMain,
      warehousePrice: patch.warehousePrice !== undefined ? patch.warehousePrice : current?.warehousePrice,
    };
    const rest = value.filter((item) => item.warehouseId !== warehouseId);
    onChange(nextItem.quantity > 0 || reserved > 0 ? [...rest, nextItem] : rest);
  };

  const delivery = rows.find((row) => row.isMain);
  const availableToOrder = delivery
    ? Math.max(0, (delivery.quantity || 0) - (delivery.reserved || 0))
    : 0;
  const total = rows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  return (
    <div>
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Склад',
            dataIndex: 'name',
            render: (name: string, row: (typeof rows)[number]) => (
              <span>
                {name}{' '}
                {row.isMain ? <Tag color="blue">онлайн-заказы</Tag> : null}
              </span>
            ),
          },
          {
            title: 'Коробок',
            dataIndex: 'quantity',
            width: 140,
            render: (_: number, row: (typeof rows)[number]) => (
              <InputNumber
                min={row.reserved}
                value={row.quantity}
                disabled={disabled}
                onChange={(quantity) => upsert(row.id, { quantity: quantity ?? row.reserved })}
                style={{ width: '100%' }}
              />
            ),
          },
          {
            title: 'Резерв',
            dataIndex: 'reserved',
            width: 90,
            render: (reserved: number) => reserved || '—',
          },
          ...(canSetWarehousePrice
            ? [{
                title: 'Цена склада',
                dataIndex: 'warehousePrice',
                width: 140,
                render: (_: number | null, row: (typeof rows)[number]) => (
                  <InputNumber
                    min={0}
                    value={row.warehousePrice ?? undefined}
                    disabled={disabled}
                    onChange={(warehousePrice) => upsert(row.id, { warehousePrice: warehousePrice ?? null })}
                    style={{ width: '100%' }}
                  />
                ),
              }]
            : []),
        ]}
      />
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        Доступно к заказу: {availableToOrder} кор. · физически на складах: {total} кор.
      </Typography.Text>
    </div>
  );
}
