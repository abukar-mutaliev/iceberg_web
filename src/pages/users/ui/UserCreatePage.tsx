import { useNavigate } from 'react-router-dom';
import { Button, Grid, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { CreateUserForm } from '@/features/user-management';

export function UserCreatePage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          К списку
        </Button>
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          Новый пользователь
        </Typography.Title>
      </Space>
      <CreateUserForm />
    </Space>
  );
}
