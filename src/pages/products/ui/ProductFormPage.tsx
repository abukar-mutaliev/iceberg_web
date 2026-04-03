import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, InputNumber, Button, Space, Typography, Upload, Image, message, Modal, Select, Grid } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getProductById, createProduct, updateProduct, getCategories, uploadProductImage } from '@/entities/product';
import { getProfile, getSuppliers } from '@/entities/user';
import { buildImageUrl, imageUrlToStoragePath } from '@/shared/lib';

// ── schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2, 'От 2 до 100 символов').max(100),
  description: z.string().optional().default(''),
  price: z.number().positive('Цена за штуку должна быть больше 0'),
  itemsPerBox: z.number().int().positive('Количество в коробке должно быть больше 0'),
  boxPrice: z.number().optional().nullable(),
  stockQuantity: z.number().int().min(0, 'Остаток не может быть отрицательным'),
  weight: z.number().optional().nullable(),
  categoryIds: z.array(z.number()).optional().default([]),
  supplierId: z.number().optional().nullable(),
}).refine(
  (data) => {
    if (data.boxPrice != null && data.boxPrice > 0 && data.price > 0 && data.itemsPerBox > 0) {
      const minBoxPrice = (data.price * data.itemsPerBox) * 0.5;
      return data.boxPrice >= minBoxPrice;
    }
    return true;
  },
  { message: 'Цена за коробку не менее 50% от цены × кол-во в коробке', path: ['boxPrice'] }
);

type ProductFormValues = z.infer<typeof productSchema>;

// ── helpers ──────────────────────────────────────────────────────────────────

interface ApiValidationError {
  type?: string;
  msg: string;
  path: string;
  location?: string;
}

function extractApiErrors(err: unknown): ApiValidationError[] {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { errors?: ApiValidationError[] } } }).response?.data;
    if (Array.isArray(data?.errors)) return data!.errors;
  }
  return [];
}

function buildFormData(
  values: ProductFormValues,
  imageFiles: File[],
  removeImageUrls?: string[],
  includeSupplierId = true,
): FormData {
  const fd = new FormData();
  fd.append('name', values.name);
  fd.append('description', values.description ?? '');
  fd.append('price', String(values.price));
  fd.append('itemsPerBox', String(values.itemsPerBox));
  fd.append('stockQuantity', String(values.stockQuantity));
  if (values.boxPrice != null && values.boxPrice > 0) fd.append('boxPrice', String(values.boxPrice));
  if (values.weight != null && values.weight > 0) fd.append('weight', String(values.weight));
  fd.append('categories', JSON.stringify(values.categoryIds ?? []));
  if (includeSupplierId && values.supplierId != null) fd.append('supplierId', String(values.supplierId));
  imageFiles.forEach((f) => fd.append('images', f));
  if (removeImageUrls?.length) {
    const pathsForApi = removeImageUrls.map((u) => imageUrlToStoragePath(u)).filter(Boolean);
    fd.append('removeImages', JSON.stringify(pathsForApi));
  }
  return fd;
}

function buildCreatePayload(values: ProductFormValues, includeSupplierId = true): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: values.name,
    description: values.description ?? '',
    price: values.price,
    itemsPerBox: values.itemsPerBox,
    stockQuantity: values.stockQuantity,
    categories: values.categoryIds ?? [],
  };

  if (values.boxPrice != null && values.boxPrice > 0) payload.boxPrice = values.boxPrice;
  if (values.weight != null && values.weight > 0) payload.weight = values.weight;
  if (includeSupplierId && values.supplierId != null) payload.supplierId = values.supplierId;

  return payload;
}

// ── component ────────────────────────────────────────────────────────────────

export function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const productId = id ? parseInt(id, 10) : 0;

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removeImageUrls, setRemoveImageUrls] = useState<string[]>([]);
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: isEdit && productId > 0,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const isAdmin = profile?.role === 'ADMIN';

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', supplierSearch],
    queryFn: () => getSuppliers(supplierSearch || undefined),
    enabled: isAdmin,
  });
  const suppliers = suppliersData ?? [];

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      itemsPerBox: 1,
      boxPrice: undefined,
      stockQuantity: 0,
      weight: undefined,
      categoryIds: [],
      supplierId: undefined,
    },
  });

  useEffect(() => {
    if (!product) return;

    const isSupplier = profile?.role === 'SUPPLIER';
    const priceForForm = isSupplier
      ? (product.supplierProposedPrice ?? product.price)
      : product.price;
    const boxPriceForForm = isSupplier
      ? (product.supplierProposedBoxPrice ?? product.boxPrice ?? product.boxInfo?.boxPrice ?? undefined)
      : (product.boxPrice ?? product.boxInfo?.boxPrice ?? undefined);

    form.reset({
      name: product.name,
      description: product.description ?? '',
      price: priceForForm,
      itemsPerBox: product.itemsPerBox,
      boxPrice: boxPriceForForm,
      stockQuantity: product.stockQuantity ?? 0,
      weight: product.weight ?? undefined,
      categoryIds: product.categories?.map((c) => c.id) ?? [],
      supplierId: isAdmin ? (product.supplier?.id ?? undefined) : undefined,
    });
    setExistingImages(product.images ?? []);
  }, [product, form, profile]);

  // ── mutations ────────────────────────────────────────────────────────────

  const handleApiErrors = (err: unknown) => {
    const apiErrors = extractApiErrors(err);
    if (apiErrors.length > 0) {
      let hasKnownField = false;
      apiErrors.forEach(({ path, msg }) => {
        const knownFields: (keyof ProductFormValues)[] = [
          'name', 'description', 'price', 'itemsPerBox', 'boxPrice',
          'stockQuantity', 'weight', 'categoryIds', 'supplierId',
        ];
        if (knownFields.includes(path as keyof ProductFormValues)) {
          form.setError(path as keyof ProductFormValues, { message: msg });
          hasKnownField = true;
        }
      });
      if (!hasKnownField) {
        const msgs = apiErrors.map((e) => e.msg).join('; ');
        message.error(msgs);
      }
    } else {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Произошла ошибка')
          : err instanceof Error
          ? err.message
          : 'Произошла ошибка';
      message.error(msg);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const createdProduct = await createProduct(payload);

      if (imageFiles.length === 0) {
        return createdProduct;
      }

      let failedUploads = 0;
      for (const file of imageFiles) {
        try {
          await uploadProductImage(createdProduct.id, file);
        } catch {
          failedUploads += 1;
        }
      }

      if (failedUploads > 0) {
        message.warning(`Товар создан, но ${failedUploads} изображ. не загрузилось`);
      }

      return createdProduct;
    },
    onSuccess: () => {
      message.success('Продукт отправлен на модерацию');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
    onError: handleApiErrors,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) => updateProduct(id, formData),
    onSuccess: () => {
      message.success('Продукт успешно обновлён');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      navigate('/products');
    },
    onError: handleApiErrors,
  });

  const onSubmit = (values: ProductFormValues) => {
    const totalImages = displayImages.length + imageFiles.length;
    if (totalImages === 0) {
      setImageError('Добавьте хотя бы одно изображение');
      return;
    }
    setImageError(null);
    if (isEdit) {
      setShowModerationWarning(true);
    } else {
      doSubmit(values);
    }
  };

  const doSubmit = (values: ProductFormValues) => {
    const removeList = removeImageUrls.length ? removeImageUrls : undefined;
    const formData = buildFormData(values, isEdit ? imageFiles : [], removeList, isAdmin);

    if (isEdit && productId) {
      updateMutation.mutate({ id: productId, formData });
    } else {
      createMutation.mutate(buildCreatePayload(values, isAdmin));
    }
    setShowModerationWarning(false);
  };

  const handleConfirmModeration = () => {
    const values = form.getValues();
    doSubmit(values);
  };

  // ── image handlers ───────────────────────────────────────────────────────

  const handleAddImages = (fileList: { originFileObj?: File }[]) => {
    const files = fileList.filter((f) => f.originFileObj).map((f) => f.originFileObj!);
    const total = existingImages.length - removeImageUrls.length + imageFiles.length + files.length;
    if (total > 10) {
      message.warning('Максимум 10 изображений');
      return;
    }
    setImageFiles((prev) => [...prev, ...files].slice(0, 10 - (existingImages.length - removeImageUrls.length)));
    setImageError(null);
  };

  const handleRemoveNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (url: string) => {
    setRemoveImageUrls((prev) => [...prev, url]);
  };

  const handleRestoreExistingImage = (url: string) => {
    setRemoveImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const displayImages = existingImages.filter((url) => !removeImageUrls.includes(url));
  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && productLoading) {
    return <Typography.Text>Загрузка...</Typography.Text>;
  }

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
      >
        <Typography.Link onClick={() => navigate('/products')}>
          <ArrowLeftOutlined /> Вернуться к списку
        </Typography.Link>
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          {isEdit ? 'Редактирование продукта' : 'Новый продукт'}
        </Typography.Title>
      </Space>

      <Card>
        <Form
          layout="vertical"
          onFinish={form.handleSubmit(onSubmit)}
          style={{ maxWidth: isMobile ? '100%' : 600 }}
        >
          {/* Supplier selector — admin only */}
          {isAdmin && (
            <Form.Item
              label="Поставщик"
              required
              validateStatus={form.formState.errors.supplierId ? 'error' : undefined}
              help={form.formState.errors.supplierId?.message}
            >
              <Controller
                name="supplierId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    showSearch
                    placeholder="Выберите поставщика"
                    filterOption={false}
                    onSearch={(v) => setSupplierSearch(v)}
                    options={suppliers.map((s) => ({ label: s.companyName, value: s.id }))}
                    value={field.value ?? undefined}
                    onChange={(v) => field.onChange(v ?? null)}
                    style={{ width: '100%' }}
                    allowClear
                    notFoundContent="Поставщики не найдены"
                  />
                )}
              />
            </Form.Item>
          )}

          <Form.Item
            label="Название"
            required
            validateStatus={form.formState.errors.name ? 'error' : undefined}
            help={form.formState.errors.name?.message}
          >
            <Controller
              name="name"
              control={form.control}
              render={({ field }) => (
                <Input placeholder="От 2 до 100 символов" maxLength={100} {...field} />
              )}
            />
          </Form.Item>

          <Form.Item label="Описание">
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Input.TextArea rows={3} placeholder="Описание продукта" {...field} />
              )}
            />
          </Form.Item>

          <Space wrap size={isMobile ? 'middle' : 'large'} style={{ width: '100%' }}>
            <Form.Item
              label="Цена за штуку (₽)"
              required
              validateStatus={form.formState.errors.price ? 'error' : undefined}
              help={form.formState.errors.price?.message}
            >
              <Controller
                name="price"
                control={form.control}
                render={({ field }) => (
                  <InputNumber
                    min={0.01}
                    step={0.01}
                    style={{ width: isMobile ? '100%' : 140 }}
                    {...field}
                    onChange={(v) => {
                      const val = v ?? 0;
                      field.onChange(val);
                      const items = form.getValues('itemsPerBox') || 1;
                      if (val > 0 && items > 0) form.setValue('boxPrice', Math.round(val * items * 100) / 100);
                    }}
                  />
                )}
              />
            </Form.Item>
            <Form.Item
              label="Штук в коробке"
              required
              validateStatus={form.formState.errors.itemsPerBox ? 'error' : undefined}
              help={form.formState.errors.itemsPerBox?.message}
            >
              <Controller
                name="itemsPerBox"
                control={form.control}
                render={({ field }) => (
                  <InputNumber
                    min={1}
                    style={{ width: isMobile ? '100%' : 120 }}
                    {...field}
                    onChange={(v) => {
                      const val = v ?? 1;
                      field.onChange(val);
                      const price = form.getValues('price') || 0;
                      const boxPrice = form.getValues('boxPrice');
                      if (val > 0) {
                        if (price > 0) form.setValue('boxPrice', Math.round(price * val * 100) / 100);
                        else if (boxPrice != null && boxPrice > 0) form.setValue('price', Math.round((boxPrice / val) * 100) / 100);
                      }
                    }}
                  />
                )}
              />
            </Form.Item>
            <Form.Item
              label="Цена за коробку (₽)"
              validateStatus={form.formState.errors.boxPrice ? 'error' : undefined}
              help={form.formState.errors.boxPrice?.message}
            >
              <Controller
                name="boxPrice"
                control={form.control}
                render={({ field }) => (
                  <InputNumber
                    min={0}
                    step={0.01}
                    style={{ width: isMobile ? '100%' : 140 }}
                    value={field.value ?? undefined}
                    onChange={(v) => {
                      const val = v ?? undefined;
                      field.onChange(val);
                      const items = form.getValues('itemsPerBox') || 1;
                      if (val != null && val > 0 && items > 0) form.setValue('price', Math.round((val / items) * 100) / 100);
                    }}
                  />
                )}
              />
            </Form.Item>
            <Form.Item
              label="Остаток (коробок)"
              validateStatus={form.formState.errors.stockQuantity ? 'error' : undefined}
              help={form.formState.errors.stockQuantity?.message}
            >
              <Controller
                name="stockQuantity"
                control={form.control}
                render={({ field }) => (
                  <InputNumber min={0} style={{ width: isMobile ? '100%' : 120 }} {...field} onChange={(v) => field.onChange(v ?? 0)} />
                )}
              />
            </Form.Item>
            <Form.Item label="Вес (г)">
              <Controller
                name="weight"
                control={form.control}
                render={({ field }) => (
                  <InputNumber
                    min={0}
                    step={0.01}
                    style={{ width: isMobile ? '100%' : 120 }}
                    value={field.value ?? undefined}
                    onChange={(v) => field.onChange(v ?? undefined)}
                  />
                )}
              />
            </Form.Item>
          </Space>

          <Form.Item label="Категории">
            <Controller
              name="categoryIds"
              control={form.control}
              render={({ field }) => (
                <Select
                  mode="multiple"
                  placeholder="Выберите категории"
                  options={categories.map((c) => ({ label: c.name, value: c.id }))}
                  value={field.value}
                  onChange={field.onChange}
                  style={{ width: '100%' }}
                />
              )}
            />
          </Form.Item>

          <Form.Item
            label="Изображения"
            required
            validateStatus={imageError ? 'error' : undefined}
            help={imageError}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {displayImages.map((url) => (
                <div key={url} style={{ position: 'relative' }}>
                  <Image
                    src={buildImageUrl(url)}
                    width={isMobile ? 72 : 80}
                    height={isMobile ? 72 : 80}
                    style={{ objectFit: 'cover' }}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ position: 'absolute', top: 0, right: 0 }}
                    onClick={() => handleRemoveExistingImage(url)}
                  />
                </div>
              ))}
              {removeImageUrls.map((url) => (
                <div key={url} style={{ opacity: 0.5, position: 'relative' }}>
                  <Image
                    src={buildImageUrl(url)}
                    width={isMobile ? 72 : 80}
                    height={isMobile ? 72 : 80}
                    style={{ objectFit: 'cover', filter: 'grayscale(1)' }}
                  />
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleRestoreExistingImage(url)}
                  >
                    Восстановить
                  </Button>
                </div>
              ))}
              {imageFiles.map((file, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    width={isMobile ? 72 : 80}
                    height={isMobile ? 72 : 80}
                    style={{ objectFit: 'cover' }}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ position: 'absolute', top: 0, right: 0 }}
                    onClick={() => handleRemoveNewImage(i)}
                  />
                </div>
              ))}
            </div>
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                handleAddImages([{ originFileObj: file }]);
                return false;
              }}
            >
              <Button icon={<PlusOutlined />} block={isMobile}>Добавить изображение</Button>
            </Upload>
            <Typography.Text type="secondary">Максимум 10 изображений</Typography.Text>
          </Form.Item>

          <Form.Item>
            <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
              <Button type="primary" htmlType="submit" loading={isPending} block={isMobile}>
                {isEdit ? 'Сохранить' : 'Создать'}
              </Button>
              <Button onClick={() => navigate('/products')} block={isMobile}>Отмена</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="Повторная модерация"
        open={showModerationWarning}
        onCancel={() => setShowModerationWarning(false)}
        onOk={handleConfirmModeration}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={isPending}
        width={isMobile ? '95vw' : undefined}
      >
        <p>При сохранении продукт снова будет отправлен на модерацию. Продолжить?</p>
      </Modal>
    </div>
  );
}