import { Tag } from 'antd';
import { USER_ROLE_LABELS, type UserRole } from '@/entities/user';

const ROLE_COLORS: Record<UserRole, string> = {
  CLIENT: 'blue',
  EMPLOYEE: 'cyan',
  SUPPLIER: 'gold',
  ADMIN: 'red',
  DRIVER: 'green',
};

interface UserRoleTagProps {
  role: UserRole;
  isSuperAdmin?: boolean;
}

export function UserRoleTag({ role, isSuperAdmin = false }: UserRoleTagProps) {
  return (
    <span>
      <Tag color={ROLE_COLORS[role]}>{USER_ROLE_LABELS[role]}</Tag>
      {isSuperAdmin && <Tag color="magenta">Суперадмин</Tag>}
    </span>
  );
}
