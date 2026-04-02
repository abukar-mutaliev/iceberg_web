import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Tabs, Select } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, Controller, type FieldPath, type UseFormClearErrors, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  login,
  registerByEmailInitiate,
  registerByEmailComplete,
  registerByPhoneInitiate,
  registerByPhoneComplete,
} from '@/features/auth';
import type { LoginResponse, RegisterEmailInitiatePayload, RegisterPhoneInitiatePayload } from '@/features/auth';
import { getDistricts } from '@/entities/district';
import { getApiMessage, isEmailOrPhone, isPhoneRu } from '@/shared/lib';

const CUSTOM_DISTRICT_VALUE = '__custom__';
const trimmedString = () => z.string().trim();

// ——— Вход ———
const loginSchema = z.object({
  email: trimmedString().min(1, 'Введите email или номер телефона').refine(isEmailOrPhone, 'Введите корректный email или номер телефона'),
  password: z.string().min(1, 'Введите пароль'),
});

// ——— Район: либо выбор из списка (districtId), либо свой (customDistrict)
const districtRefine = (d: { districtId?: number | string | null; customDistrict?: string }) => {
  const hasId = typeof d.districtId === 'number' && d.districtId > 0;
  const hasCustom = d.districtId === CUSTOM_DISTRICT_VALUE && typeof d.customDistrict === 'string' && d.customDistrict.trim().length >= 2;
  return hasId || hasCustom;
};

// ——— Регистрация по email ———
const registerEmailSchema = z.object({
  name: trimmedString().min(2, 'Минимум 2 символа'),
  email: trimmedString().min(1, 'Введите email').email('Некорректный email'),
  phone: trimmedString().min(1, 'Введите телефон').refine(isPhoneRu, 'Некорректный номер РФ'),
  password: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string(),
  districtId: z.union([z.number(), z.string(), z.null()]).optional(),
  customDistrict: trimmedString().optional(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Пароли не совпадают', path: ['confirmPassword'] })
  .refine(districtRefine, { message: 'Выберите район из списка или введите свой', path: ['districtId'] });

// ——— Регистрация по телефону ———
const registerPhoneSchema = z.object({
  name: trimmedString().min(2, 'Минимум 2 символа'),
  phone: trimmedString().min(1, 'Введите телефон').refine(isPhoneRu, 'Некорректный номер РФ'),
  password: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string(),
  districtId: z.union([z.number(), z.string(), z.null()]).optional(),
  customDistrict: trimmedString().optional(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Пароли не совпадают', path: ['confirmPassword'] })
  .refine(districtRefine, { message: 'Выберите район из списка или введите свой', path: ['districtId'] });

// ——— Код подтверждения ———
const codeSchema = z.object({
  code: trimmedString().length(6, 'Код из 6 цифр').regex(/^\d{6}$/, 'Только цифры'),
});

type RegisterEmailFormValues = z.infer<typeof registerEmailSchema>;
type RegisterPhoneFormValues = z.infer<typeof registerPhoneSchema>;
type CodeFormValues = z.infer<typeof codeSchema>;
type ValidationErrorItem = {
  msg?: string;
  message?: string;
  path?: string;
  param?: string;
  field?: string;
};

const LOG = (msg: string, data?: unknown) => {
  console.log('[Login]', msg, data !== undefined ? data : '');
};

function extractValidationErrors(error: unknown): ValidationErrorItem[] {
  const responseData = (error as { response?: { data?: { errors?: unknown } } })?.response?.data;
  if (!responseData || !Array.isArray(responseData.errors)) {
    return [];
  }
  return responseData.errors as ValidationErrorItem[];
}

function applyRegisterFormErrors<T extends RegisterEmailFormValues | RegisterPhoneFormValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  clearErrors: UseFormClearErrors<T>,
) {
  clearErrors();

  let applied = false;
  const validationErrors = extractValidationErrors(error);
  for (const item of validationErrors) {
    const rawField = (item.field ?? item.path ?? item.param ?? '').trim();
    const errorMessage = item.message ?? item.msg ?? 'Некорректное значение';
    let targetField: FieldPath<T> | null = null;

    if (rawField === 'name') targetField = 'name' as FieldPath<T>;
    if (rawField === 'email') targetField = 'email' as FieldPath<T>;
    if (rawField === 'phone') targetField = 'phone' as FieldPath<T>;
    if (rawField === 'password') targetField = 'password' as FieldPath<T>;
    if (rawField === 'confirmPassword') targetField = 'confirmPassword' as FieldPath<T>;
    if (rawField === 'districtId') targetField = 'districtId' as FieldPath<T>;
    if (rawField === 'customDistrict') targetField = 'customDistrict' as FieldPath<T>;
    if (!targetField && /район/i.test(errorMessage)) targetField = 'districtId' as FieldPath<T>;

    if (targetField) {
      setError(targetField, { type: 'server', message: errorMessage });
      applied = true;
    }
  }

  const apiMessage = getApiMessage(error);
  if (/email/i.test(apiMessage)) {
    setError('email' as FieldPath<T>, { type: 'server', message: apiMessage });
    applied = true;
  } else if (/номер.*телефон|телефон/i.test(apiMessage)) {
    setError('phone' as FieldPath<T>, { type: 'server', message: apiMessage });
    applied = true;
  } else if (/район/i.test(apiMessage)) {
    setError('districtId' as FieldPath<T>, { type: 'server', message: apiMessage });
    applied = true;
  }

  return applied;
}

function getAuthRole(response: LoginResponse | undefined): string | undefined {
  const payloadData = response?.data ?? (response as unknown as LoginResponse['data'] | undefined);
  return payloadData?.user?.role;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';


  const [mainTab, setMainTab] = useState<'login' | 'register'>('login');
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone'>('email');
  const [registerStep, setRegisterStep] = useState<'form' | 'code'>('form');
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);

  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const loginFormRef = useRef<HTMLFormElement>(null);

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  });

  const emailRegisterForm = useForm<RegisterEmailFormValues>({
    resolver: zodResolver(registerEmailSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', districtId: undefined, customDistrict: '' },
  });
  const phoneRegisterForm = useForm<RegisterPhoneFormValues>({
    resolver: zodResolver(registerPhoneSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { name: '', phone: '', password: '', confirmPassword: '', districtId: undefined, customDistrict: '' },
  });
  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { code: '' },
  });

  const navigateAfterAuth = (response: LoginResponse | undefined, successText: string) => {
    const role = getAuthRole(response);
    message.success(successText);

    if (role === 'CLIENT') {
      navigate('/client-access', { replace: true });
      return;
    }

    navigate(from, { replace: true });
  };

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      navigateAfterAuth(response, 'Вход выполнен');
    },
    onError: (err) => {
      LOG('Ошибка входа', {
        message: getApiMessage(err),
        status: (err as { response?: { status?: number } })?.response?.status,
        data: (err as { response?: { data?: unknown } })?.response?.data,
      });
      message.error(getApiMessage(err));
    },
  });

  const emailInitiateMutation = useMutation({
    mutationFn: (payload: RegisterEmailInitiatePayload) => registerByEmailInitiate(payload),
    onSuccess: (res) => {
      emailRegisterForm.clearErrors();
      if (res?.registrationToken) {
        setRegistrationToken(res.registrationToken);
        setRegisterStep('code');
        message.success('Код отправлен на email');
      } else {
        message.error('Не получен токен для подтверждения');
      }
    },
    onError: (err) => {
      const applied = applyRegisterFormErrors(err, emailRegisterForm.setError, emailRegisterForm.clearErrors);
      if (!applied) {
        message.error(getApiMessage(err));
      }
    },
  });

  const emailCompleteMutation = useMutation({
    mutationFn: ({ code }: CodeFormValues) => {
      if (!registrationToken) throw new Error('Нет токена');
      return registerByEmailComplete(registrationToken, code);
    },
    onSuccess: (response) => {
      navigateAfterAuth(response, 'Регистрация завершена');
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const phoneInitiateMutation = useMutation({
    mutationFn: (payload: RegisterPhoneInitiatePayload) => registerByPhoneInitiate(payload),
    onSuccess: (res) => {
      phoneRegisterForm.clearErrors();
      if (res?.registrationToken) {
        setRegistrationToken(res.registrationToken);
        setRegisterStep('code');
        message.success('Код отправлен по СМС');
      } else {
        message.error('Не получен токен для подтверждения');
      }
    },
    onError: (err) => {
      const applied = applyRegisterFormErrors(err, phoneRegisterForm.setError, phoneRegisterForm.clearErrors);
      if (!applied) {
        message.error(getApiMessage(err));
      }
    },
  });

  const phoneCompleteMutation = useMutation({
    mutationFn: ({ code }: CodeFormValues) => {
      if (!registrationToken) throw new Error('Нет токена');
      return registerByPhoneComplete(registrationToken, code);
    },
    onSuccess: (response) => {
      navigateAfterAuth(response, 'Регистрация завершена');
    },
    onError: (err) => message.error(getApiMessage(err)),
  });

  const onLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginErrors({});
    const form = e.currentTarget;
    const email = (form.elements.namedItem('login-email') as HTMLInputElement)?.value?.trim() ?? '';
    const password = (form.elements.namedItem('login-password') as HTMLInputElement)?.value ?? '';
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const err = result.error.flatten();
      setLoginErrors({
        email: (err.fieldErrors.email as string[])?.[0],
        password: (err.fieldErrors.password as string[])?.[0],
      });
      return;
    }
    loginMutation.mutate(result.data);
  };

  const onEmailRegisterSubmit = emailRegisterForm.handleSubmit((data) => {
    emailRegisterForm.clearErrors();
    const payload: RegisterEmailInitiatePayload = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
    };
    if (data.districtId === CUSTOM_DISTRICT_VALUE && data.customDistrict?.trim()) {
      payload.customDistrict = data.customDistrict.trim();
    } else if (typeof data.districtId === 'number' && data.districtId > 0) {
      payload.districtId = data.districtId;
    }
    emailInitiateMutation.mutate(payload);
  });

  const onPhoneRegisterSubmit = phoneRegisterForm.handleSubmit((data) => {
    phoneRegisterForm.clearErrors();
    const payload: RegisterPhoneInitiatePayload = {
      name: data.name,
      phone: data.phone,
      password: data.password,
    };
    if (data.districtId === CUSTOM_DISTRICT_VALUE && data.customDistrict?.trim()) {
      payload.customDistrict = data.customDistrict.trim();
    } else if (typeof data.districtId === 'number' && data.districtId > 0) {
      payload.districtId = data.districtId;
    }
    phoneInitiateMutation.mutate(payload);
  });

  const onCodeSubmit = (data: CodeFormValues) => {
    if (registerMethod === 'email') {
      emailCompleteMutation.mutate(data);
    } else {
      phoneCompleteMutation.mutate(data);
    }
  };

  const backToRegisterForm = () => {
    setRegisterStep('form');
    setRegistrationToken(null);
    codeForm.reset();
  };

  const isCodeStep = mainTab === 'register' && registerStep === 'code';

  return (
    <div style={{ maxWidth: 450, margin: '80px auto', padding: 16 }}>
      <Card title={<Typography.Title level={3}>Вход в панель администратора</Typography.Title>}>
        <Tabs
          activeKey={mainTab}
          onChange={(k) => {
            setMainTab(k as 'login' | 'register');
            setRegisterStep('form');
            setRegistrationToken(null);
          }}
          items={[
            {
              key: 'login',
              label: 'Вход',
              children: (
                <form ref={loginFormRef} onSubmit={onLoginSubmit} autoComplete="off">
                  <Form layout="vertical" component="div">
                    <Form.Item
                      label="Email или номер телефона"
                      validateStatus={loginErrors.email ? 'error' : undefined}
                      help={loginErrors.email}
                    >
                      <Input
                        name="login-email"
                        id="login-email"
                        placeholder="email@example.com или 8 (928) 123-45-67"
                        autoComplete="username"
                        type="text"
                      />
                    </Form.Item>
                    <Form.Item
                      label="Пароль"
                      validateStatus={loginErrors.password ? 'error' : undefined}
                      help={loginErrors.password}
                    >
                      <Input.Password name="login-password" id="login-password" placeholder="Пароль" autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={loginMutation.isPending} block>
                        Войти
                      </Button>
                    </Form.Item>
                  </Form>
                </form>
              ),
            },
            {
              key: 'register',
              label: 'Регистрация',
              children: isCodeStep ? (
                <form onSubmit={(e) => { e.preventDefault(); codeForm.handleSubmit(onCodeSubmit)(e); }} autoComplete="off">
                  <Form layout="vertical" component="div">
                    <Typography.Paragraph type="secondary">
                      Введите код подтверждения из {registerMethod === 'email' ? 'письма' : 'СМС'}
                    </Typography.Paragraph>
                    <Form.Item
                      validateStatus={codeForm.formState.errors.code ? 'error' : undefined}
                      help={codeForm.formState.errors.code?.message}
                    >
                      <Controller
                        name="code"
                        control={codeForm.control}
                        render={({ field }) => (
                          <Input
                            placeholder="123456"
                            maxLength={6}
                            autoComplete="off"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        )}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={emailCompleteMutation.isPending || phoneCompleteMutation.isPending} block>
                        Подтвердить
                      </Button>
                    </Form.Item>
                    <Button type="link" onClick={backToRegisterForm} block style={{ padding: 0 }}>
                      ← Назад к форме
                    </Button>
                  </Form>
                </form>
              ) : (
                <>
                  <Tabs
                    activeKey={registerMethod}
                    onChange={(k) => setRegisterMethod(k as 'email' | 'phone')}
                    size="small"
                    style={{ marginBottom: 16 }}
                    items={[
                      { key: 'email', label: 'По email' },
                      { key: 'phone', label: 'По телефону' },
                    ]}
                  />
                  {registerMethod === 'email' ? (
                    <form onSubmit={onEmailRegisterSubmit} autoComplete="off">
                      <Form layout="vertical" component="div">
                        <Form.Item
                          label="Имя"
                          validateStatus={emailRegisterForm.formState.errors.name ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.name?.message}
                        >
                          <Controller
                            name="name"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Input
                                placeholder="Иван Иванов"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Email"
                          validateStatus={emailRegisterForm.formState.errors.email ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.email?.message}
                        >
                          <Controller
                            name="email"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Input
                                type="email"
                                placeholder="email@example.com"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Телефон"
                          validateStatus={emailRegisterForm.formState.errors.phone ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.phone?.message}
                        >
                          <Controller
                            name="phone"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Input
                                placeholder="89281234567"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Пароль"
                          validateStatus={emailRegisterForm.formState.errors.password ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.password?.message}
                        >
                          <Controller
                            name="password"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Input.Password
                                placeholder="Минимум 6 символов"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Повторите пароль"
                          validateStatus={emailRegisterForm.formState.errors.confirmPassword ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.confirmPassword?.message}
                        >
                          <Controller
                            name="confirmPassword"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Input.Password
                                placeholder="Повторите пароль"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Район"
                          validateStatus={emailRegisterForm.formState.errors.districtId || emailRegisterForm.formState.errors.customDistrict ? 'error' : undefined}
                          help={emailRegisterForm.formState.errors.districtId?.message ?? emailRegisterForm.formState.errors.customDistrict?.message}
                        >
                          <Controller
                            name="districtId"
                            control={emailRegisterForm.control}
                            render={({ field }) => (
                              <Select
                                {...field}
                                placeholder="Выберите район"
                                allowClear
                                options={[
                                  ...districts.map((d) => ({ value: d.id, label: d.name })),
                                  { value: CUSTOM_DISTRICT_VALUE, label: '+ Добавить свой район' },
                                ]}
                                value={field.value === undefined ? undefined : field.value}
                                onChange={(v) => field.onChange(v ?? undefined)}
                              />
                            )}
                          />
                        </Form.Item>
                        {emailRegisterForm.watch('districtId') === CUSTOM_DISTRICT_VALUE && (
                          <Form.Item label="Название своего района" validateStatus={emailRegisterForm.formState.errors.customDistrict ? 'error' : undefined} help={emailRegisterForm.formState.errors.customDistrict?.message}>
                            <Controller
                              name="customDistrict"
                              control={emailRegisterForm.control}
                              render={({ field }) => (
                                <Input
                                  placeholder="Введите название района"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              )}
                            />
                          </Form.Item>
                        )}
                        <Form.Item>
                          <Button type="primary" htmlType="submit" loading={emailInitiateMutation.isPending} block>
                            Зарегистрироваться
                          </Button>
                        </Form.Item>
                      </Form>
                    </form>
                  ) : (
                    <form onSubmit={onPhoneRegisterSubmit} autoComplete="off">
                      <Form layout="vertical" component="div">
                        <Form.Item
                          label="Имя"
                          validateStatus={phoneRegisterForm.formState.errors.name ? 'error' : undefined}
                          help={phoneRegisterForm.formState.errors.name?.message}
                        >
                          <Controller
                            name="name"
                            control={phoneRegisterForm.control}
                            render={({ field }) => (
                              <Input
                                placeholder="Иван Иванов"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Телефон"
                          validateStatus={phoneRegisterForm.formState.errors.phone ? 'error' : undefined}
                          help={phoneRegisterForm.formState.errors.phone?.message}
                        >
                          <Controller
                            name="phone"
                            control={phoneRegisterForm.control}
                            render={({ field }) => (
                              <Input
                                placeholder="89281234567"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Пароль"
                          validateStatus={phoneRegisterForm.formState.errors.password ? 'error' : undefined}
                          help={phoneRegisterForm.formState.errors.password?.message}
                        >
                          <Controller
                            name="password"
                            control={phoneRegisterForm.control}
                            render={({ field }) => (
                              <Input.Password
                                placeholder="Минимум 6 символов"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Повторите пароль"
                          validateStatus={phoneRegisterForm.formState.errors.confirmPassword ? 'error' : undefined}
                          help={phoneRegisterForm.formState.errors.confirmPassword?.message}
                        >
                          <Controller
                            name="confirmPassword"
                            control={phoneRegisterForm.control}
                            render={({ field }) => (
                              <Input.Password
                                placeholder="Повторите пароль"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            )}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Район"
                          validateStatus={phoneRegisterForm.formState.errors.districtId || phoneRegisterForm.formState.errors.customDistrict ? 'error' : undefined}
                          help={phoneRegisterForm.formState.errors.districtId?.message ?? phoneRegisterForm.formState.errors.customDistrict?.message}
                        >
                          <Controller
                            name="districtId"
                            control={phoneRegisterForm.control}
                            render={({ field }) => (
                              <Select
                                {...field}
                                placeholder="Выберите район"
                                allowClear
                                options={[
                                  ...districts.map((d) => ({ value: d.id, label: d.name })),
                                  { value: CUSTOM_DISTRICT_VALUE, label: '+ Добавить свой район' },
                                ]}
                                value={field.value === undefined ? undefined : field.value}
                                onChange={(v) => field.onChange(v ?? undefined)}
                              />
                            )}
                          />
                        </Form.Item>
                        {phoneRegisterForm.watch('districtId') === CUSTOM_DISTRICT_VALUE && (
                          <Form.Item label="Название своего района" validateStatus={phoneRegisterForm.formState.errors.customDistrict ? 'error' : undefined} help={phoneRegisterForm.formState.errors.customDistrict?.message}>
                            <Controller
                              name="customDistrict"
                              control={phoneRegisterForm.control}
                              render={({ field }) => (
                                <Input
                                  placeholder="Введите название района"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              )}
                            />
                          </Form.Item>
                        )}
                        <Form.Item>
                          <Button type="primary" htmlType="submit" loading={phoneInitiateMutation.isPending} block>
                            Зарегистрироваться
                          </Button>
                        </Form.Item>
                      </Form>
                    </form>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
