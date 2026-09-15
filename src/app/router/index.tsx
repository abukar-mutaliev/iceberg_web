import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth';
import { RoleGate } from '@/features/user-management';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ProfilePage } from '@/pages/profile';
import { ProductListPage, ProductFormPage, ProductDetailPage } from '@/pages/products';
import { ReturnsListPage, ReturnDetailPage } from '@/pages/returns';
import { FeedbacksPage } from '@/pages/feedbacks';
import { WarehousesListPage, WarehouseDetailPage } from '@/pages/warehouses';
import { ClientAccessPage } from '@/pages/client-access';
import { UserCreatePage, UserDetailPage, UserListPage } from '@/pages/users';
import { StaffApplicationsPage } from '@/pages/staff-applications';
import { MainLayout } from '@/widgets/layout';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client-access" element={<ClientAccessPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="returns" element={<ReturnsListPage />} />
        <Route path="returns/:id" element={<ReturnDetailPage />} />
        <Route path="feedbacks" element={<FeedbacksPage />} />
        <Route path="warehouses" element={<WarehousesListPage />} />
        <Route path="warehouses/:id" element={<WarehouseDetailPage />} />
        <Route
          path="users"
          element={(
            <RoleGate roles={['ADMIN']}>
              <UserListPage />
            </RoleGate>
          )}
        />
        <Route
          path="users/new"
          element={(
            <RoleGate roles={['ADMIN']}>
              <UserCreatePage />
            </RoleGate>
          )}
        />
        <Route
          path="users/:userId"
          element={(
            <RoleGate roles={['ADMIN']}>
              <UserDetailPage />
            </RoleGate>
          )}
        />
        <Route
          path="staff-applications"
          element={(
            <RoleGate roles={['ADMIN']} superAdmin fallback={<Navigate to="/users" replace />}>
              <StaffApplicationsPage />
            </RoleGate>
          )}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
