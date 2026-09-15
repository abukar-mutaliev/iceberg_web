import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Checkbox, Form, Input, Modal, Select, message } from 'antd';
import type { StaffApplicationRole } from '@/entities/staff-application';
import { getApiMessage } from '@/shared/lib';
import { approveStaffApplication } from '../api/staff-admin-api';
import type { StaffApplicationListItem } from '../api/staff-admin-api';
import { getDistrictsForSelection, getWarehousesForSelection } from '../api/selection-api';
import { userManagementKeys } from '../model/query-keys';
import type { ApproveStaffApplicationPayload } from '../model/types';

const ROLE_HINT: Record<StaffApplicationRole, string> = {
  EMPLOYEE: 'Нужны районы и склады (или «все активные»).',
  DRIVER: 'Нужны районы. Склад можно не указывать.',
  SUPPLIER: 'Компания будет создана из имени клиента. Отдельные реквизиты в этом шаге задать нельзя.',
};

interface ApproveStaffApplicationModalProps {
  open: boolean;
  application: StaffApplicationListItem | null;
  onClose: () => void;
}

export function ApproveStaffApplicationModal({
  open,
  application,
  onClose,
}: ApproveStaffApplicationModalProps) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState('');
  const [districts, setDistricts] = useState<number[]>([]);
  const [warehouseIds, setWarehouseIds] = useState<number[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [allWarehouses, setAllWarehouses] = useState(false);

  useEffect(() => {
    if (!open || !application) return;
    setPosition('');
    setDistricts(application.districtIds);
    setWarehouseIds([]);
    setWarehouseId(null);
    setAllWarehouses(false);
  }, [open, application]);

  const warehousesQuery = useQuery({
    queryKey: userManagementKeys.warehouseSelection(),
    queryFn: () => getWarehousesForSelection(),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const districtsQuery = useQuery({
    queryKey: userManagementKeys.districtSelection(),
    queryFn: getDistrictsForSelection,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload: ApproveStaffApplicationPayload) =>
      approveStaffApplication(application!.id, payload),
    onSuccess: async (serverMessage) => {
      message.success(serverMessage);
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.all });
      onClose();
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

  const handleOk = () => {
    if (!application) return;
    const role = application.desiredRole;

    if (role === 'SUPPLIER') {
      mutation.mutate({});
      return;
    }

    if (districts.length < 1) {
      message.error('Выберите хотя бы один район');
      return;
    }

    if (role === 'EMPLOYEE') {
      if (!allWarehouses && warehouseIds.length < 1) {
        message.error('Выберите склады или отметьте «Все активные склады»');
        return;
      }
      mutation.mutate({
        position: position.trim() || undefined,
        districts,
        allWarehouses: allWarehouses || undefined,
        warehouseIds: allWarehouses ? undefined : warehouseIds,
      });
      return;
    }

    mutation.mutate({
      districts,
      warehouseId: warehouseId ?? undefined,
    });
  };

  return (
    <Modal
      title="Одобрить заявку"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Одобрить"
      confirmLoading={mutation.isPending}
      destroyOnClose
    >
      {application && (
        <>
          <Alert
            type={application.desiredRole === 'SUPPLIER' ? 'warning' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message={ROLE_HINT[application.desiredRole]}
          />
          <Form layout="vertical">
            {application.desiredRole === 'EMPLOYEE' && (
              <Form.Item label="Должность">
                <Input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Сотрудник" />
              </Form.Item>
            )}

            {application.desiredRole !== 'SUPPLIER' && (
              <Form.Item label="Районы" required>
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  options={districtOptions}
                  value={districts}
                  onChange={setDistricts}
                  loading={districtsQuery.isPending}
                />
              </Form.Item>
            )}

            {application.desiredRole === 'EMPLOYEE' && (
              <>
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
                <Form.Item label="Склады" required={!allWarehouses}>
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    options={warehouseOptions}
                    value={warehouseIds}
                    onChange={setWarehouseIds}
                    disabled={allWarehouses}
                    loading={warehousesQuery.isPending}
                  />
                </Form.Item>
              </>
            )}

            {application.desiredRole === 'DRIVER' && (
              <Form.Item label="Склад">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={warehouseOptions}
                  value={warehouseId ?? undefined}
                  onChange={(value) => setWarehouseId(value ?? null)}
                  loading={warehousesQuery.isPending}
                />
              </Form.Item>
            )}
          </Form>
        </>
      )}
    </Modal>
  );
}
