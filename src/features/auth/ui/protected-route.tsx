import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { tokenStorage } from '@/shared/api';
import { getProfile } from '@/entities/user';

const ALLOWED_ROLES = ['SUPPLIER', 'EMPLOYEE', 'ADMIN'];

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Проверяет наличие токена и роль (SUPPLIER, EMPLOYEE, ADMIN).
 * При отсутствии токена — редирект на /login.
 * При роли не из списка — редирект на /login.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [status, setStatus] = useState<'pending' | 'allowed' | 'client' | 'forbidden'>('pending');

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setStatus('forbidden');
      return;
    }
    getProfile()
      .then((user) => {
        if (ALLOWED_ROLES.includes(user.role)) {
          setStatus('allowed');
          return;
        }
        if (user.role === 'CLIENT') {
          setStatus('client');
          return;
        }
        setStatus('forbidden');
      })
      .catch(() => {
        tokenStorage.clear();
        setStatus('forbidden');
      });
  }, []);

  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (status === 'client') {
    return <Navigate to="/client-access" replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
