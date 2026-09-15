import type { ProcessingRole, UserRole } from './types';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Клиент',
  EMPLOYEE: 'Сотрудник',
  SUPPLIER: 'Поставщик',
  ADMIN: 'Администратор',
  DRIVER: 'Водитель',
};

export const PROCESSING_ROLE_LABELS: Record<ProcessingRole, string> = {
  PICKER: 'Сборщик',
  PACKER: 'Упаковщик',
  QUALITY_CHECKER: 'Контролер качества',
  COURIER: 'Курьер',
  SUPERVISOR: 'Начальник смены',
  MANAGER: 'Менеджер',
};

export const PROCESSING_ROLES = Object.keys(PROCESSING_ROLE_LABELS) as ProcessingRole[];
