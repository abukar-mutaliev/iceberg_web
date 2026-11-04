import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Checkbox,
  Grid,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { DislikeFilled, LikeFilled } from '@ant-design/icons';
import { formatDate, getApiMessage } from '@/shared/lib';
import {
  getAiChatLogs,
  isCriticalAiLog,
  type AiChatLog,
  type AiLogSortField,
} from '../api/ai-logs-api';

const PAGE_SIZE = 20;

const SORT_FIELDS: AiLogSortField[] = ['createdAt', 'confidenceScore', 'userId'];

function sortOrderOf(field: AiLogSortField, sortBy: AiLogSortField, sortOrder: 'asc' | 'desc') {
  if (sortBy !== field) return undefined;
  return sortOrder === 'asc' ? 'ascend' as const : 'descend' as const;
}

export function AiMonitoringPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | undefined>();
  const [problematicOnly, setProblematicOnly] = useState(false);
  const [sortBy, setSortBy] = useState<AiLogSortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const logsQuery = useQuery({
    queryKey: ['admin', 'ai-logs', page, category, problematicOnly, sortBy, sortOrder],
    queryFn: () => getAiChatLogs({
      page,
      category,
      problematic: problematicOnly,
      sortBy,
      sortOrder,
    }),
  });

  const logs = logsQuery.data?.logs ?? [];
  const categories = logsQuery.data?.categories ?? [];
  const total = logsQuery.data?.total ?? 0;

  const columns: ColumnsType<AiChatLog> = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: true,
      sortOrder: sortOrderOf('createdAt', sortBy, sortOrder),
      render: (value: string) => formatDate(value),
    },
    {
      title: 'ID пользователя',
      dataIndex: 'userId',
      key: 'userId',
      width: 140,
      sorter: true,
      sortOrder: sortOrderOf('userId', sortBy, sortOrder),
      render: (userId: number | null, row) => (
        <Space size={6}>
          <span>{userId ?? '—'}</span>
          {row.userFeedback === 1 && <LikeFilled style={{ color: '#52c41a' }} title="Лайк" />}
          {row.userFeedback === -1 && <DislikeFilled style={{ color: '#ff4d4f' }} title="Дизлайк" />}
        </Space>
      ),
    },
    {
      title: 'Вопрос',
      dataIndex: 'userQuery',
      key: 'userQuery',
      width: 260,
      render: (text: string) => (
        <Typography.Paragraph ellipsis={{ rows: 3, tooltip: text }} style={{ marginBottom: 0 }}>
          {text}
        </Typography.Paragraph>
      ),
    },
    {
      title: 'Ответ ИИ',
      dataIndex: 'aiResponse',
      key: 'aiResponse',
      width: 320,
      render: (text: string) => (
        <Typography.Paragraph ellipsis={{ rows: 3, tooltip: text }} style={{ marginBottom: 0 }}>
          {text}
        </Typography.Paragraph>
      ),
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (value: string | null) => value || '—',
    },
    {
      title: 'Намерение',
      dataIndex: 'userIntent',
      key: 'userIntent',
      width: 180,
      render: (value: string | null) => value || '—',
    },
    {
      title: 'Уверенность',
      dataIndex: 'confidenceScore',
      key: 'confidenceScore',
      width: 130,
      sorter: true,
      sortOrder: sortOrderOf('confidenceScore', sortBy, sortOrder),
      render: (score: number | null) => {
        if (score == null) return '—';
        const low = score < 3;
        return <Typography.Text type={low ? 'danger' : undefined}>{score} / 5</Typography.Text>;
      },
    },
    {
      title: 'Данные отсутствуют',
      dataIndex: 'dataMissing',
      key: 'dataMissing',
      width: 160,
      render: (missing: boolean) => (
        missing ? <Tag color="error">Да</Tag> : <Tag>Нет</Tag>
      ),
    },
  ];

  const handleTableChange: TableProps<AiChatLog>['onChange'] = (pagination, _filters, sorter) => {
    const current = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = current?.field;
    let nextSortBy = sortBy;
    let nextSortOrder = sortOrder;

    if (current?.order && typeof field === 'string' && SORT_FIELDS.includes(field as AiLogSortField)) {
      nextSortBy = field as AiLogSortField;
      nextSortOrder = current.order === 'ascend' ? 'asc' : 'desc';
    } else if (current && !current.order) {
      nextSortBy = 'createdAt';
      nextSortOrder = 'desc';
    }

    if (nextSortBy !== sortBy || nextSortOrder !== sortOrder) {
      setSortBy(nextSortBy);
      setSortOrder(nextSortOrder);
      setPage(1);
      return;
    }

    if (pagination.current) setPage(pagination.current);
  };

  return (
    <div>
      <style>
        {`.ai-log-critical > td { background: #fff1f0 !important; }
          .ai-log-critical:hover > td { background: #ffccc7 !important; }`}
      </style>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
      >
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          Мониторинг ИИ
        </Typography.Title>
        <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
          <Select
            allowClear
            placeholder="Все категории"
            value={category}
            style={{ width: isMobile ? '100%' : 240 }}
            options={categories.map((item) => ({ label: item, value: item }))}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
          />
          <Checkbox
            checked={problematicOnly}
            onChange={(event) => {
              setProblematicOnly(event.target.checked);
              setPage(1);
            }}
          >
            Показать только проблемные
          </Checkbox>
        </Space>
      </Space>

      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Бледно-красные строки — нет данных или уверенность ниже 3. Зелёный палец — лайк, красный — дизлайк.
      </Typography.Paragraph>

      {logsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={getApiMessage(logsQuery.error)}
        />
      )}

      <Table<AiChatLog>
        rowKey="id"
        loading={logsQuery.isLoading}
        columns={columns}
        dataSource={logs}
        scroll={{ x: 1400 }}
        rowClassName={(record) => (isCriticalAiLog(record) ? 'ai-log-critical' : '')}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (count) => `Всего ${count}`,
        }}
        locale={{ emptyText: 'Записей пока нет' }}
      />
    </div>
  );
}
