import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { tokenStorage } from '@/shared/api';
import { getApiMessage } from '@/shared/lib';
import { getDistricts } from '@/entities/district';
import { getProfile } from '@/entities/user';
import { logout } from '@/features/auth';
import {
  applyForStaff,
  getMyStaffApplication,
  type StaffApplication,
  type StaffApplicationPayload,
  type StaffApplicationRole,
} from '@/features/staff-application';

const staffRoleOptions: Array<{ value: StaffApplicationRole; label: string; description: string }> = [
  {
    value: 'EMPLOYEE',
    label: 'Сотрудник',
    description: 'Склад, сборка, упаковка, сопровождение процессов.',
  },
  {
    value: 'SUPPLIER',
    label: 'Поставщик',
    description: 'Поставка продукции, расширение ассортимента и работа с заявками.',
  },
  {
    value: 'DRIVER',
    label: 'Водитель',
    description: 'Маршруты, развозка и работа по закреплённым районам.',
  },
];

const APPLICATION_STATUS_LABELS: Record<StaffApplication['status'], string> = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
};

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} не должно превышать ${max} символов`);

const applicationSchema = z.object({
  desiredRole: z.enum(['EMPLOYEE', 'SUPPLIER', 'DRIVER']),
  districts: z.array(z.number()).default([]),
  reason: z.string().trim().min(10, 'Опишите, почему хотите присоединиться к команде').max(1000, 'Описание не должно превышать 1000 символов'),
  experience: optionalText(1500, 'Опыт'),
  additionalInfo: optionalText(1500, 'Дополнительная информация'),
}).superRefine((data, ctx) => {
  if ((data.desiredRole === 'EMPLOYEE' || data.desiredRole === 'DRIVER') && data.districts.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['districts'],
      message: 'Выберите хотя бы один район',
    });
  }
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;
type ValidationErrorItem = {
  field?: string;
  path?: string;
  param?: string;
  message?: string;
  msg?: string;
};

function extractValidationErrors(error: unknown): ValidationErrorItem[] {
  const responseData = (error as { response?: { data?: { errors?: unknown } } })?.response?.data;
  if (!responseData || !Array.isArray(responseData.errors)) {
    return [];
  }
  return responseData.errors as ValidationErrorItem[];
}

function parseDistrictIds(raw?: string | null): number[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    }
  } catch {
    // fall through to comma-separated fallback
  }

  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function getRoleLabel(role: StaffApplicationRole) {
  return staffRoleOptions.find((option) => option.value === role)?.label ?? role;
}

function getStatusTone(status: StaffApplication['status']) {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'warning';
  return 'processing';
}

function getStatusLabel(status: StaffApplication['status']) {
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

export function ClientAccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = tokenStorage.getAccessToken();

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      desiredRole: 'EMPLOYEE',
      districts: [],
      reason: '',
      experience: '',
      additionalInfo: '',
    },
  });

  const selectedRole = form.watch('desiredRole');

  const { data: user, isLoading: isProfileLoading, isError: isProfileError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: false,
    enabled: Boolean(token),
  });

  const { data: districts = [], isLoading: isDistrictsLoading } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
    enabled: Boolean(token),
  });

  const { data: application, isLoading: isApplicationLoading } = useQuery({
    queryKey: ['my-staff-application'],
    queryFn: getMyStaffApplication,
    enabled: Boolean(token),
  });

  const districtMap = useMemo(
    () => new Map(districts.map((district) => [district.id, district.name])),
    [districts],
  );

  const selectedRoleMeta = staffRoleOptions.find((option) => option.value === selectedRole);
  const applicationDistrictNames = useMemo(() => {
    return parseDistrictIds(application?.districts)
      .map((districtId) => districtMap.get(districtId) ?? `Район #${districtId}`);
  }, [application?.districts, districtMap]);

  const submitMutation = useMutation({
    mutationFn: (payload: StaffApplicationPayload) => applyForStaff(payload),
    onSuccess: async () => {
      message.success('Заявка успешно отправлена');
      form.reset({
        desiredRole: 'EMPLOYEE',
        districts: [],
        reason: '',
        experience: '',
        additionalInfo: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['my-staff-application'] });
    },
    onError: (error) => {
      let applied = false;
      for (const item of extractValidationErrors(error)) {
        const field = (item.field ?? item.path ?? item.param ?? '').trim();
        const errorMessage = item.message ?? item.msg ?? 'Некорректное значение';

        if (field === 'desiredRole') {
          form.setError('desiredRole', { type: 'server', message: errorMessage });
          applied = true;
        } else if (field === 'districts') {
          form.setError('districts', { type: 'server', message: errorMessage });
          applied = true;
        } else if (field === 'reason') {
          form.setError('reason', { type: 'server', message: errorMessage });
          applied = true;
        } else if (field === 'experience') {
          form.setError('experience', { type: 'server', message: errorMessage });
          applied = true;
        } else if (field === 'additionalInfo') {
          form.setError('additionalInfo', { type: 'server', message: errorMessage });
          applied = true;
        }
      }

      if (!applied) {
        message.error(getApiMessage(error));
      }
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors();

    submitMutation.mutate({
      desiredRole: values.desiredRole,
      ...(values.desiredRole !== 'SUPPLIER' && values.districts.length > 0 ? { districts: values.districts } : {}),
      reason: values.reason,
      experience: values.experience,
      additionalInfo: values.additionalInfo,
    });
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isProfileLoading || isDistrictsLoading || isApplicationLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isProfileError || !user) {
    tokenStorage.clear();
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'CLIENT') {
    return <Navigate to="/" replace />;
  }

  const hasPendingApplication = application?.status === 'PENDING';

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px 16px',
        background: 'linear-gradient(180deg, #f2f7ff 0%, #ffffff 45%, #f8f8f8 100%)',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <Space direction="vertical" size={4}>
            <Tag color="blue" style={{ width: 'fit-content', paddingInline: 10, borderRadius: 999 }}>
              Личный кабинет клиента
            </Tag>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Доступ в админ-панель пока недоступен
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 700 }}>
              Вы вошли как клиент. Управленческий кабинет доступен только сотрудникам команды. Если хотите присоединиться к Iceberg,
              отправьте заявку ниже, и администратор её рассмотрит.
            </Typography.Paragraph>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Выйти
          </Button>
        </div>

        <Row gutter={[24, 24]} align="stretch">
          <Col xs={24} lg={13}>
            <Card
              style={{
                borderRadius: 24,
                border: '1px solid #d6e4ff',
                boxShadow: '0 20px 50px rgba(9, 30, 66, 0.08)',
                background: 'linear-gradient(135deg, #0f62fe 0%, #2f54eb 55%, #597ef7 100%)',
              }}
            >
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Tag color="gold" style={{ width: 'fit-content', borderRadius: 999 }}>
                  Команда Iceberg
                </Tag>
                <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>
                  Мы уже знаем ваш аккаунт, осталось только рассказать, как вы хотите работать с нами
                </Typography.Title>
                <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.88)', fontSize: 16, margin: 0 }}>
                  После отправки заявки администратор увидит вашу анкету, желаемую роль и информацию по районам. Когда заявка будет одобрена,
                  роль в системе обновится, и доступ в рабочий кабинет откроется автоматически.
                </Typography.Paragraph>

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card style={{ borderRadius: 18, background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.18)' }}>
                      <Space align="start">
                        <TeamOutlined style={{ fontSize: 22, color: '#fff', marginTop: 4 }} />
                        <Space direction="vertical" size={4}>
                          <Typography.Text strong style={{ color: '#fff' }}>
                            Гибкие роли
                          </Typography.Text>
                          <Typography.Text style={{ color: 'rgba(255,255,255,0.82)' }}>
                            Можно выбрать роль сотрудника, поставщика или водителя.
                          </Typography.Text>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card style={{ borderRadius: 18, background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.18)' }}>
                      <Space align="start">
                        <SafetyCertificateOutlined style={{ fontSize: 22, color: '#fff', marginTop: 4 }} />
                        <Space direction="vertical" size={4}>
                          <Typography.Text strong style={{ color: '#fff' }}>
                            Быстрое рассмотрение
                          </Typography.Text>
                          <Typography.Text style={{ color: 'rgba(255,255,255,0.82)' }}>
                            После одобрения доступ к панели появится без повторной регистрации.
                          </Typography.Text>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card style={{ borderRadius: 20, border: 'none', boxShadow: 'none', background: 'rgba(255,255,255,0.94)' }}>
                  <Space direction="vertical" size={8}>
                    <Typography.Text strong>Ваш текущий аккаунт</Typography.Text>
                    <Typography.Text type="secondary">
                      Email: {user.email ?? 'не указан'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Телефон: {user.phone ?? 'не указан'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Роль: клиент
                    </Typography.Text>
                  </Space>
                </Card>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={11}>
            <Card
              style={{
                borderRadius: 24,
                border: '1px solid #e5e7eb',
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
              }}
            >
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <div>
                  <Typography.Title level={4} style={{ marginBottom: 8 }}>
                    Заявка на вступление в команду
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    Заполните краткую анкету. Чем точнее информация, тем быстрее администратор сможет принять решение.
                  </Typography.Paragraph>
                </div>

                {application && (
                  <Alert
                    type={application.status === 'REJECTED' ? 'warning' : application.status === 'APPROVED' ? 'success' : 'info'}
                    showIcon
                    message={
                      application.status === 'REJECTED'
                        ? 'Последняя заявка была отклонена'
                        : application.status === 'APPROVED'
                        ? 'Заявка одобрена'
                        : 'Заявка уже отправлена'
                    }
                    description={
                      <Space direction="vertical" size={6}>
                        <Typography.Text>
                          Статус: <Tag color={getStatusTone(application.status)}>{getStatusLabel(application.status)}</Tag>
                        </Typography.Text>
                        <Typography.Text>
                          Желаемая роль: {getRoleLabel(application.desiredRole)}
                        </Typography.Text>
                        {applicationDistrictNames.length > 0 && (
                          <Typography.Text>
                            Районы: {applicationDistrictNames.join(', ')}
                          </Typography.Text>
                        )}
                        {application.rejectionReason && (
                          <Typography.Text>
                            Причина отклонения: {application.rejectionReason}
                          </Typography.Text>
                        )}
                      </Space>
                    }
                  />
                )}

                {hasPendingApplication ? (
                  <Card
                    style={{
                      borderRadius: 20,
                      background: '#fafcff',
                      borderColor: '#d6e4ff',
                    }}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#1677ff' }} />
                        <Typography.Text strong>Заявка уже ожидает рассмотрения</Typography.Text>
                      </Space>
                      <Typography.Text type="secondary">
                        Повторно отправлять анкету не нужно. Как только администратор рассмотрит заявку, ваш доступ будет обновлён.
                      </Typography.Text>
                    </Space>
                  </Card>
                ) : (
                  <form onSubmit={onSubmit}>
                    <Form layout="vertical" component="div">
                      <Form.Item
                        label="Желаемая роль"
                        validateStatus={form.formState.errors.desiredRole ? 'error' : undefined}
                        help={form.formState.errors.desiredRole?.message}
                      >
                        <Controller
                          name="desiredRole"
                          control={form.control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onChange={(value) => {
                                field.onChange(value);
                                if (value === 'SUPPLIER') {
                                  form.setValue('districts', [], { shouldValidate: true });
                                }
                              }}
                              options={staffRoleOptions.map((option) => ({
                                value: option.value,
                                label: option.label,
                              }))}
                            />
                          )}
                        />
                      </Form.Item>

                      {selectedRoleMeta && (
                        <Alert
                          type="info"
                          showIcon
                          message={selectedRoleMeta.label}
                          description={selectedRoleMeta.description}
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      {(selectedRole === 'EMPLOYEE' || selectedRole === 'DRIVER') && (
                        <Form.Item
                          label="Районы, в которых готовы работать"
                          validateStatus={form.formState.errors.districts ? 'error' : undefined}
                          help={form.formState.errors.districts?.message}
                        >
                          <Controller
                            name="districts"
                            control={form.control}
                            render={({ field }) => (
                              <Select
                                mode="multiple"
                                placeholder="Выберите один или несколько районов"
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                                options={districts.map((district) => ({
                                  value: district.id,
                                  label: district.name,
                                }))}
                              />
                            )}
                          />
                        </Form.Item>
                      )}

                      <Form.Item
                        label="Почему вы хотите присоединиться к команде?"
                        validateStatus={form.formState.errors.reason ? 'error' : undefined}
                        help={form.formState.errors.reason?.message}
                      >
                        <Controller
                          name="reason"
                          control={form.control}
                          render={({ field }) => (
                            <Input.TextArea
                              rows={4}
                              placeholder="Коротко расскажите о своей мотивации"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.value)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              maxLength={1000}
                              showCount
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Опыт работы"
                        validateStatus={form.formState.errors.experience ? 'error' : undefined}
                        help={form.formState.errors.experience?.message ?? 'Необязательно, но полезно для рассмотрения заявки'}
                      >
                        <Controller
                          name="experience"
                          control={form.control}
                          render={({ field }) => (
                            <Input.TextArea
                              rows={3}
                              placeholder="Опишите релевантный опыт, навыки или предыдущие проекты"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.value)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              maxLength={1500}
                              showCount
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Дополнительная информация"
                        validateStatus={form.formState.errors.additionalInfo ? 'error' : undefined}
                        help={form.formState.errors.additionalInfo?.message ?? 'График, транспорт, пожелания или любые детали'}
                      >
                        <Controller
                          name="additionalInfo"
                          control={form.control}
                          render={({ field }) => (
                            <Input.TextArea
                              rows={3}
                              placeholder="Например: удобный график, наличие авто, интерес к определённому направлению"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.value)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              maxLength={1500}
                              showCount
                            />
                          )}
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        loading={submitMutation.isPending}
                      >
                        Отправить заявку
                      </Button>
                    </Form>
                  </form>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
