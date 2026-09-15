import { getApiMessage } from '@/shared/lib';

export interface ApiFieldError {
  path: string;
  message: string;
}

export class ApiRequestError extends Error {
  fieldErrors: ApiFieldError[];

  constructor(message: string, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.fieldErrors = fieldErrors;
  }
}

function extractFieldErrors(error: unknown): ApiFieldError[] {
  if (!error || typeof error !== 'object' || !('response' in error)) return [];
  const errors = (error as {
    response?: { data?: { errors?: unknown } };
  }).response?.data?.errors;
  if (!Array.isArray(errors)) return [];

  return errors.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { path?: unknown; param?: unknown; msg?: unknown; message?: unknown };
    const rawPath = typeof row.path === 'string'
      ? row.path
      : typeof row.param === 'string'
        ? row.param
        : '';
    const path = rawPath.includes('.') ? rawPath.split('.').pop() ?? rawPath : rawPath;
    const message = typeof row.msg === 'string'
      ? row.msg
      : typeof row.message === 'string'
        ? row.message
        : '';
    if (!path || !message) return [];
    return [{ path, message }];
  });
}

export async function requestApi<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(getApiMessage(error), extractFieldErrors(error));
  }
}

export function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function toRequestBody(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key] = value;
  }

  if (result.allWarehouses === true) {
    delete result.warehouseId;
    delete result.warehouseIds;
  }

  return result;
}
