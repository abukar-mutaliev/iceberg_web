import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getProfile, type UserRole } from '@/entities/user';

interface RoleGateProps {
  roles?: UserRole[];
  superAdmin?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({
  roles,
  superAdmin = false,
  fallback,
  children,
}: RoleGateProps) {
  const { data: user, isPending, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  if (isPending) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <Spin size="large" />
      </div>
    );
  }

  const allowedByRole = !roles || Boolean(user && roles.includes(user.role));
  const allowedBySuper = !superAdmin || user?.admin?.isSuperAdmin === true;

  if (isError || !user || !allowedByRole || !allowedBySuper) {
    return <>{fallback ?? <Navigate to="/" replace />}</>;
  }

  return <>{children}</>;
}
