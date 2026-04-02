import axios from 'axios';
import { env } from '@/shared/config';
import { tokenStorage } from '@/shared/api';

const BASE = env.API_BASE_URL;

export interface LoginPayload {
  /** Email или номер телефона — бэкенд определяет по формату */
  email: string;
  password: string;
}

export interface LoginResponse {
  status?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: { id: number; email: string | null; role: string };
  };
}

/**
 * Логин: email или телефон + пароль.
 * Бэкенд: POST /api/auth/login, поле email принимает и email, и номер телефона.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(`${BASE}/api/auth/login`, payload);
  const payloadData = data?.data ?? (data as unknown as LoginResponse['data']);
  const access = payloadData?.accessToken ?? (payloadData as { access_token?: string })?.access_token;
  const refresh = payloadData?.refreshToken ?? (payloadData as { refresh_token?: string })?.refresh_token;
  if (access && refresh) {
    tokenStorage.setTokens(access, refresh);
  }
  return data;
}

/** Регистрация по email: шаг 1 — запрос кода на почту. Бэкенд: POST /api/auth/register/initiate. Передаётся districtId либо customDistrict. */
export interface RegisterEmailInitiatePayload {
  email: string;
  password: string;
  name: string;
  phone: string;
  address?: string;
  gender?: string;
  districtId?: number;
  customDistrict?: string;
}

export interface RegisterInitiateResponse {
  status?: string;
  registrationToken?: string;
  message?: string;
}

export async function registerByEmailInitiate(payload: RegisterEmailInitiatePayload): Promise<RegisterInitiateResponse> {
  const { data } = await axios.post<RegisterInitiateResponse>(`${BASE}/api/auth/register/initiate`, payload);
  const token = data?.registrationToken ?? (data as { registrationToken?: string })?.registrationToken;
  return { ...data, registrationToken: token };
}

/** Регистрация по email: шаг 2 — ввод кода. Бэкенд: POST /api/auth/register/complete */
export async function registerByEmailComplete(registrationToken: string, verificationCode: string): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(`${BASE}/api/auth/register/complete`, {
    registrationToken,
    verificationCode,
  });
  const payloadData = data?.data ?? (data as unknown as LoginResponse['data']);
  const access = payloadData?.accessToken;
  const refresh = payloadData?.refreshToken;
  if (access && refresh) {
    tokenStorage.setTokens(access, refresh);
  }
  return data;
}

/** Регистрация по телефону: шаг 1 — запрос кода по СМС. Бэкенд: POST /api/auth/initiate-register-phone */
export interface RegisterPhoneInitiatePayload {
  phone: string;
  name: string;
  password?: string;
  address?: string;
  gender?: string;
  districtId?: number;
  customDistrict?: string;
}

export async function registerByPhoneInitiate(payload: RegisterPhoneInitiatePayload): Promise<RegisterInitiateResponse> {
  const { data } = await axios.post<{ status?: string; data?: { registrationToken?: string }; message?: string; registrationToken?: string }>(
    `${BASE}/api/auth/initiate-register-phone`,
    payload
  );
  const token = data?.data?.registrationToken ?? data?.registrationToken ?? (data as { registrationToken?: string })?.registrationToken;
  return { ...data, registrationToken: token };
}

/** Регистрация по телефону: шаг 2 — ввод кода. Бэкенд: POST /api/auth/complete-register-phone */
export async function registerByPhoneComplete(registrationToken: string, verificationCode: string): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(`${BASE}/api/auth/complete-register-phone`, {
    registrationToken,
    verificationCode,
  });
  const payloadData = data?.data ?? (data as unknown as LoginResponse['data']);
  const access = payloadData?.accessToken;
  const refresh = payloadData?.refreshToken;
  if (access && refresh) {
    tokenStorage.setTokens(access, refresh);
  }
  return data;
}

/**
 * Выход: очистка токенов. Если на бэкенде есть logout — вызвать его.
 */
export async function logout(): Promise<void> {
  try {
    const token = tokenStorage.getAccessToken();
    const refresh = tokenStorage.getRefreshToken();
    if (token) {
      await axios.post(
        `${BASE}/api/auth/logout`,
        refresh ? { refreshToken: refresh } : {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
  } finally {
    tokenStorage.clear();
  }
}
