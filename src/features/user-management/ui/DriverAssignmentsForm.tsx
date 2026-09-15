import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Select, Space, message } from 'antd';
import type { NamedRef } from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import { updateDriverDistricts, updateDriverWarehouse } from '../api/driver-admin-api';
import { getDistrictsForSelection, getWarehousesForSelection } from '../api/selection-api';
import { userManagementKeys } from '../model/query-keys';

interface DriverAssignmentsFormProps {
  driverId: number;
  userId?: number | null;
  districts: NamedRef[];
  warehouse: NamedRef | null;
}

export function DriverAssignmentsForm({
  driverId,
  userId,
  districts: initialDistricts,
  warehouse,
}: DriverAssignmentsFormProps) {
  const queryClient = useQueryClient();
  const [districts, setDistricts] = useState<number[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);

  useEffect(() => {
    setDistricts(initialDistricts.map((item) => item.id));
    setWarehouseId(warehouse?.id ?? null);
  }, [initialDistricts, warehouse]);

  const warehousesQuery = useQuery({
    queryKey: userManagementKeys.warehouseSelection(),
    queryFn: () => getWarehousesForSelection(),
    staleTime: 5 * 60_000,
  });
  const districtsQuery = useQuery({
    queryKey: userManagementKeys.districtSelection(),
    queryFn: getDistrictsForSelection,
    staleTime: 5 * 60_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: userManagementKeys.driver(driverId) });
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.detail(userId) });
    }
  };

  const districtsMutation = useMutation({
    mutationFn: () => updateDriverDistricts(driverId, districts),
    onSuccess: async (result) => {
      message.success(result.message);
      await invalidate();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const warehouseMutation = useMutation({
    mutationFn: () => updateDriverWarehouse(driverId, warehouseId),
    onSuccess: async (result) => {
      message.success(result.message);
      await invalidate();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const warehouseOptions = (warehousesQuery.data ?? [])
    .filter((item) => item.isActive !== false)
    .map((item) => ({ label: item.name, value: item.id }));
  const districtOptions = (districtsQuery.data ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));

  return (
    <Form layout="vertical">
      <Form.Item label="Районы">
        <Space.Compact style={{ width: '100%' }}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            options={districtOptions}
            value={districts}
            onChange={setDistricts}
            loading={districtsQuery.isPending}
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            loading={districtsMutation.isPending}
            onClick={() => districtsMutation.mutate()}
          >
            Сохранить
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item label="Склад" extra="Пустое значение отвяжет склад">
        <Space.Compact style={{ width: '100%' }}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Не назначен"
            options={warehouseOptions}
            value={warehouseId ?? undefined}
            onChange={(value) => setWarehouseId(value ?? null)}
            loading={warehousesQuery.isPending}
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            loading={warehouseMutation.isPending}
            onClick={() => warehouseMutation.mutate()}
          >
            Сохранить
          </Button>
        </Space.Compact>
      </Form.Item>
    </Form>
  );
}
