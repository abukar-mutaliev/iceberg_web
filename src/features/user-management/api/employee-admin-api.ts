import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { Employee, ProcessingRole } from '@/entities/user';
import { toEmployee } from './adapters';
import { requestApi, toRequestBody } from './request';

function unwrapEmployee(raw: unknown): Employee {
  const payload = (raw ?? {}) as { data?: { employee?: unknown }; employee?: unknown };
  const employee = payload.data?.employee ?? payload.employee ?? raw;
  return toEmployee(employee);
}

export async function getEmployeeDetails(employeeId: number): Promise<Employee> {
  return requestApi((async () => {
    const { data } = await apiClient.get<ApiResponse<{ employee?: unknown }>>(
      `/api/employee/${employeeId}/details`,
    );
    const employee = unwrapEmployee(data);
    if (!employee.id) throw new Error('Сотрудник не найден');
    return employee;
  })());
}

export async function updateEmployeeDistricts(
  employeeId: number,
  districts: number[],
): Promise<{ employee: Employee; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.put<ApiResponse<{ employee?: unknown }>>(
      `/api/employee/${employeeId}/districts`,
      { districts },
    );
    return {
      employee: unwrapEmployee(data),
      message: data.message ?? 'Районы и склад сотрудника успешно обновлены',
    };
  })());
}

export async function updateEmployeeWarehouses(
  employeeId: number,
  payload: {
    warehouseIds?: number[];
    warehouseId?: number;
    allWarehouses?: boolean;
  },
): Promise<{ employee: Employee; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.put<ApiResponse<{ employee?: unknown }>>(
      `/api/employee/${employeeId}/warehouse`,
      toRequestBody({ ...payload }),
    );
    return {
      employee: unwrapEmployee(data),
      message: data.message ?? 'Склады сотрудника обновлены',
    };
  })());
}

export async function assignProcessingRole(
  employeeId: number,
  processingRole: ProcessingRole,
): Promise<{ employee: Employee; message: string }> {
  return requestApi((async () => {
    const { data } = await apiClient.patch<ApiResponse<{ employee?: unknown }>>(
      `/api/admin/employees/${employeeId}/processing-role`,
      { processingRole },
    );
    return {
      employee: unwrapEmployee(data),
      message: data.message ?? 'Должность успешно назначена',
    };
  })());
}
