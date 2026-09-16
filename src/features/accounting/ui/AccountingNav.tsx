import { Button, Space } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getProfile } from '@/entities/user';
import { resolveClientProfile } from '@/entities/accounting';

type Section = 'summary' | 'sales' | 'warehouses' | 'supplies' | 'inventory' | 'movements' | 'control' | 'audit';

const ADMIN_ITEMS: Array<{ key: Section; path: string; label: string }> = [
  { key: 'summary', path: '/accounting', label: 'Сводка' },
  { key: 'sales', path: '/accounting/sales', label: 'Продажи' },
  { key: 'warehouses', path: '/accounting/warehouses', label: 'Склады' },
  { key: 'supplies', path: '/accounting/supplies', label: 'Поставки' },
  { key: 'inventory', path: '/accounting/inventory', label: 'Инвентаризация' },
  { key: 'movements', path: '/accounting/movements', label: 'Движения' },
  { key: 'control', path: '/accounting/control', label: 'Контроль' },
];

const EMPLOYEE_ITEMS: Array<{ key: Section; path: string; label: string }> = [
  { key: 'supplies', path: '/accounting/supplies', label: 'Поставки' },
  { key: 'inventory', path: '/accounting/inventory', label: 'Инвентаризация' },
];

function activeSection(pathname: string): Section {
  if (pathname.startsWith('/accounting/sales')) return 'sales';
  if (pathname.startsWith('/accounting/warehouses')) return 'warehouses';
  if (pathname.startsWith('/accounting/supplies')) return 'supplies';
  if (pathname.startsWith('/accounting/inventory')) return 'inventory';
  if (pathname.startsWith('/accounting/movements')) return 'movements';
  if (pathname.startsWith('/accounting/control')) return 'control';
  if (pathname.startsWith('/accounting/audit')) return 'audit';
  return 'summary';
}

interface AccountingNavProps {
  extra?: ReactNode;
}

export function AccountingNav({ extra }: AccountingNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: user } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const profile = resolveClientProfile(user);
  const isEmployee = user?.role === 'EMPLOYEE';
  const items = isEmployee ? EMPLOYEE_ITEMS : ADMIN_ITEMS;
  const current = activeSection(pathname);
  const showAudit = !isEmployee && (profile === 'FULL' || profile === 'FINANCIER');

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <Space wrap>
        {items.map((item) => (
          <Button
            key={item.key}
            type={current === item.key ? 'primary' : 'default'}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </Button>
        ))}
        {showAudit && (
          <Button
            type={current === 'audit' ? 'primary' : 'default'}
            onClick={() => navigate('/accounting/audit')}
          >
            Аудит
          </Button>
        )}
      </Space>
      {extra ? <Space wrap>{extra}</Space> : null}
    </div>
  );
}
