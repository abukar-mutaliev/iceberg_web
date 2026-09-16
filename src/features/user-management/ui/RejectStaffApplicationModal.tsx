import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, Input, Modal, message } from 'antd';
import { getApiMessage } from '@/shared/lib';
import { rejectStaffApplication } from '../api/staff-admin-api';
import type { StaffApplicationListItem } from '../api/staff-admin-api';
import { userManagementKeys } from '../model/query-keys';

interface RejectStaffApplicationModalProps {
  open: boolean;
  application: StaffApplicationListItem | null;
  onClose: () => void;
}

export function RejectStaffApplicationModal({
  open,
  application,
  onClose,
}: RejectStaffApplicationModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => rejectStaffApplication(application!.id, reason.trim()),
    onSuccess: async (serverMessage) => {
      message.success(serverMessage);
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.all });
      onClose();
    },
    onError: (error) => message.error(getApiMessage(error)),
  });

  const handleOk = () => {
    if (reason.trim().length < 3) {
      message.error('Укажите причину отклонения');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      title="Отклонить заявку"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Отклонить"
      okButtonProps={{ danger: true }}
      confirmLoading={mutation.isPending}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="Причина" required>
          <Input.TextArea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Минимум 3 символа"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
