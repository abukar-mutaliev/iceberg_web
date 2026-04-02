import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Space } from 'antd';
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { logout } from '@/features/auth';
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/entities/user';
import logo from '@/assets/logo/logo.png';

const { Header, Sider, Content } = Layout;

const BASE_MENU = [
  { key: '/',          label: 'Кабинет'  },
  { key: '/products',  label: 'Продукты' },
  { key: '/returns',   label: 'Возвраты' },
  { key: '/feedbacks', label: 'Отзывы'   },
  { key: '/profile',   label: 'Профиль'  },
];

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  const { data: user } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isAdmin = user?.role === 'ADMIN';

  const menuItems = isAdmin
    ? [
        ...BASE_MENU,
        { key: '/warehouses', label: 'Склады' },
      ]
    : BASE_MENU;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName =
    user?.supplier?.companyName ??
    user?.employee?.name ??
    user?.admin?.name ??
    user?.email ??
    'Пользователь';

  const siderWidth = collapsed ? 80 : 200;

  // Highlight the first path segment, e.g. "/warehouses/5" → "/warehouses"
  const selectedKey = location.pathname === '/'
    ? '/'
    : `/${location.pathname.split('/').filter(Boolean)[0] ?? ''}`;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: collapsed ? 48 : 64,
            margin: collapsed ? '12px 8px' : '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
        >
          <img
            src={logo}
            alt="Iceberg"
            style={{
              width: collapsed ? 28 : 80,
              objectFit: 'contain',
              transition: 'width 0.2s',
            }}
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Typography.Text type="secondary">{displayName}</Typography.Text>
          </Space>
          <Button type="text" danger icon={<LogoutOutlined />} onClick={handleLogout}>
            Выйти
          </Button>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
