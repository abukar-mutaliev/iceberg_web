import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Space, Grid, ConfigProvider } from 'antd';
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  AppstoreOutlined,
  SwapOutlined,
  MessageOutlined,
  UserOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { logout } from '@/features/auth';
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/entities/user';
import logo from '@/assets/logo/logo.png';

const { Header, Sider, Content } = Layout;

const BASE_MENU = [
  { key: '/',          label: 'Кабинет',  icon: <HomeOutlined /> },
  { key: '/products',  label: 'Продукты', icon: <AppstoreOutlined /> },
  { key: '/returns',   label: 'Возвраты', icon: <SwapOutlined /> },
  { key: '/feedbacks', label: 'Отзывы',   icon: <MessageOutlined /> },
  { key: '/profile',   label: 'Профиль',  icon: <UserOutlined /> },
];

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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
        { key: '/warehouses', label: 'Склады', icon: <BankOutlined /> },
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

  const effectiveCollapsed = isMobile ? true : collapsed;
  const siderWidth = isMobile ? 50 : (effectiveCollapsed ? 80 : 200);

  // Highlight the first path segment, e.g. "/warehouses/5" → "/warehouses"
  const selectedKey = location.pathname === '/'
    ? '/'
    : `/${location.pathname.split('/').filter(Boolean)[0] ?? ''}`;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={effectiveCollapsed}
        width={siderWidth}
        collapsedWidth={siderWidth}
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
            height: effectiveCollapsed ? 40 : 64,
            margin: effectiveCollapsed ? '8px 6px' : '12px 16px',
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
              width: effectiveCollapsed ? (isMobile ? 20 : 28) : 80,
              objectFit: 'contain',
              transition: 'width 0.2s',
            }}
          />
        </div>
        <ConfigProvider
          theme={{
            components: {
              Menu: {
                itemHeight: isMobile ? 44 : 40,
                itemBorderRadius: isMobile ? 12 : 8,
                itemMarginInline: isMobile ? 6 : 4,
                itemMarginBlock: isMobile ? 6 : 4,
                itemSelectedBg: '#2b3f68',
                itemHoverBg: '#1f2f4a',
              },
            },
          }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              paddingRight: isMobile ? 10 : undefined,
              textAlign: isMobile ? 'center' : undefined,
            }}
          />
        </ConfigProvider>
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
              icon={effectiveCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              disabled={isMobile}
            />
            {!isMobile && <Typography.Text type="secondary">{displayName}</Typography.Text>}
          </Space>
          <Button type="text" danger icon={<LogoutOutlined />} onClick={handleLogout}>
            {!isMobile && 'Выйти'}
          </Button>
        </Header>

        <Content
          style={{
            margin: isMobile ? 10 : 24,
            padding: isMobile ? 12 : 24,
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
