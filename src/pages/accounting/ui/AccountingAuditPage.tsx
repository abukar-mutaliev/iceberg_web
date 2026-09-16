import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Alert, Empty, Grid } from 'antd';
import { getAccountingAudit } from '@/entities/accounting';
import { accountingKeys, AccountingNav, auditActionLabel, entityTypeLabel } from '@/features/accounting';
import { getApiMessage, formatDate } from '@/shared/lib';

const { Title } = Typography;

export function AccountingAuditPage() {
  const screens = Grid.useBreakpoint();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: accountingKeys.audit(page),
    queryFn: () => getAccountingAudit({ page }),
  });
  if (error) return (
    <div>
      <AccountingNav />
      <Alert type="error" message={getApiMessage(error)} />
    </div>
  );
  return (
    <div>
      <AccountingNav />
      <Title level={4}>Журнал аудита</Title>
      <Card>
        {!data?.items?.length && !isLoading ? <Empty description="Записей нет" /> : (
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={data?.items}
            scroll={screens.md ? undefined : { x: 800 }}
            columns={[
              { title: 'Время', dataIndex: 'createdAt', render: (v: string) => formatDate(v) },
              { title: 'Действие', dataIndex: 'action', render: (v: string) => auditActionLabel(v) },
              { title: 'Сущность', key: 'entity', render: (_: unknown, row: { entityType: string; entityId: number | null }) => `${entityTypeLabel(row.entityType)}${row.entityId ? ` №${row.entityId}` : ''}` },
              { title: 'Пользователь', dataIndex: ['user', 'email'] },
              { title: 'Причина', dataIndex: 'reason' },
            ]}
            pagination={{ current: page, total: data?.pagination.total, onChange: setPage }}
          />
        )}
      </Card>
    </div>
  );
}
