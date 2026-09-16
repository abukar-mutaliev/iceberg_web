import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Modal, Typography, message } from 'antd';
import { USER_ROLE_LABELS, type UserDetail } from '@/entities/user';
import { getApiMessage } from '@/shared/lib';
import { deleteManagedUser } from '../api/admin-users-api';
import { userManagementKeys } from '../model/query-keys';

interface DeleteUserModalProps {
  open: boolean;
  user: UserDetail;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteUserModal({ open, user, onClose, onDeleted }: DeleteUserModalProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteManagedUser(user.userId, user.role),
    onSuccess: async (serverMessage) => {
      message.success(serverMessage);
      await queryClient.invalidateQueries({ queryKey: userManagementKeys.all });
      onDeleted();
    },
    onError: (error) => {
      message.error(getApiMessage(error));
    },
  });

  return (
    <Modal
      title="Удалить пользователя"
      open={open}
      onCancel={onClose}
      okText="Удалить"
      okButtonProps={{ danger: true }}
      confirmLoading={mutation.isPending}
      cancelText="Отмена"
      onOk={() => mutation.mutateAsync()}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={`Удалить ${user.displayName} (${USER_ROLE_LABELS[user.role]})?`}
      />
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Если у клиента есть заказы, сервер отклонит удаление. Это действие нельзя отменить.
      </Typography.Paragraph>
    </Modal>
  );
}
