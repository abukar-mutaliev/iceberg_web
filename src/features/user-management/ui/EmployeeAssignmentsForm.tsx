import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Select, Space, Typography, message } from 'antd';
import {
  PROCESSING_ROLE_LABELS,
  PROCESSING_ROLES,
  type Employee,
  type ProcessingRole,
} from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import {
  assignProcessingRole,
  updateEmployeeDistricts,
  updateEmployeeWarehouses,
} from '../api/employee-admin-api';
import { getDistrictsForSelection, getWarehousesForSelection } from '../api/selection-api';
import { userManagementKeys } from '../model/query-keys';

interface EmployeeAssignmentsFormProps {
  employee: Employee;
  isSuperAdmin: boolean;
}

export function EmployeeAssignmentsForm({ employee, isSuperAdmin }: EmployeeAssignmentsFormProps) {
  const queryClient = useQueryClient();
  const [districts, setDistricts] = useState<number[]>([]);
  const [warehouseIds, setWarehouseIds] = useState<number[]>([]);
  const [allWarehouses, setAllWarehouses] = useState(false);
  const [processingRole, setProcessingRole] = useState<ProcessingRole | null>(null);

  useEffect(() => {
    setDistricts(employee.districts?.map((item) => item.id) ?? []);
    setWarehouseIds(
      employee.warehouses?.map((item) => item.id)
        ?? (employee.warehouse?.id ? [employee.warehouse.id] : []),
    );
    setAllWarehouses(false);
    setProcessingRole(employee.processingRole ?? null);
  }, [employee]);

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
    await queryClient.invalidateQueries({ queryKey: userManagementKeys.employee(employee.id) });
    if (employee.userId) {
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.detail(employee.userId) });
    }
  };

  const districtsMutation = useMutation({
    mutationFn: () => updateEmployeeDistricts(employee.id, districts),
    onSuccess: async (result) => {
      message.success(result.message);
      await invalidate();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const warehousesMutation = useMutation({
    mutationFn: () => updateEmployeeWarehouses(employee.id, {
      allWarehouses: allWarehouses || undefined,
      warehouseIds: allWarehouses ? undefined : warehouseIds,
    }),
    onSuccess: async (result) => {
      message.success(result.message);
      await invalidate();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const processingMutation = useMutation({
    mutationFn: (role: ProcessingRole) => assignProcessingRole(employee.id, role),
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
      <Form.Item
        label="Районы"
        extra="Основной склад может обновиться автоматически"
      >
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
            disabled={districts.length < 1}
            onClick={() => districtsMutation.mutate()}
          >
            Сохранить
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item>
        <Checkbox
          checked={allWarehouses}
          onChange={(event) => {
            setAllWarehouses(event.target.checked);
            if (event.target.checked) setWarehouseIds([]);
          }}
        >
          Все активные склады
        </Checkbox>
      </Form.Item>

      <Form.Item label="Склады">
        <Space.Compact style={{ width: '100%' }}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            options={warehouseOptions}
            value={warehouseIds}
            onChange={setWarehouseIds}
            disabled={allWarehouses}
            loading={warehousesQuery.isPending}
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            loading={warehousesMutation.isPending}
            disabled={!allWarehouses && warehouseIds.length < 1}
            onClick={() => warehousesMutation.mutate()}
          >
            Сохранить
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item label="Обработка заказов">
        {isSuperAdmin ? (
          <Space.Compact style={{ width: '100%' }}>
            <Select
              allowClear
              placeholder="Не назначена"
              options={PROCESSING_ROLES.map((item) => ({
                label: PROCESSING_ROLE_LABELS[item],
                value: item,
              }))}
              value={processingRole ?? undefined}
              onChange={(value) => setProcessingRole(value ?? null)}
              style={{ width: '100%' }}
            />
            <Button
              type="primary"
              loading={processingMutation.isPending}
              disabled={!processingRole}
              onClick={() => processingRole && processingMutation.mutate(processingRole)}
            >
              Назначить
            </Button>
          </Space.Compact>
        ) : (
          <Typography.Text>
            {processingRole ? PROCESSING_ROLE_LABELS[processingRole] : 'Не назначена'}
          </Typography.Text>
        )}
      </Form.Item>
    </Form>
  );
}
