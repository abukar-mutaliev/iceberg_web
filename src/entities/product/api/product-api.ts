import { apiClient } from '@/shared/api';
import type { ApiResponse } from '@/shared/api';
import type { Product, ProductsListParams, ProductsListResponse, Category } from '../model/types';

const DEFAULT_MAX_IMAGE_BYTES = 1.8 * 1024 * 1024;
const FALLBACK_MAX_IMAGE_BYTES = 900 * 1024;
const DEFAULT_MAX_IMAGE_DIMENSION = 1600;

type ProductMutationResponse = {
  status?: string;
  data?: Product | { product?: Product };
  message?: string;
};

function extractProductFromMutationResponse(payload: ProductMutationResponse): Product | undefined {
  const responseData = payload.data;
  if (!responseData) return undefined;
  if ('id' in responseData) return responseData;
  return responseData.product;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    image.src = objectUrl;
  });
}

async function canvasToJpegFile(
  image: HTMLImageElement,
  originalFile: File,
  width: number,
  height: number,
  quality: number,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось создать canvas для обработки изображения');
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Не удалось сжать изображение'));
      },
      'image/jpeg',
      quality,
    );
  });

  const nextName = originalFile.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${nextName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function optimizeImageForUpload(file: File, maxBytes: number): Promise<File> {
  const looksLikeImage = file.type.startsWith('image/');
  if (!looksLikeImage) return file;
  if (file.size <= maxBytes) return file;

  const image = await loadImage(file);
  const largestSide = Math.max(image.width, image.height);
  const initialScale = largestSide > DEFAULT_MAX_IMAGE_DIMENSION
    ? DEFAULT_MAX_IMAGE_DIMENSION / largestSide
    : 1;

  let width = image.width * initialScale;
  let height = image.height * initialScale;
  let quality = 0.82;
  let candidate = await canvasToJpegFile(image, file, width, height, quality);
  let attempts = 0;

  while (candidate.size > maxBytes && attempts < 6) {
    quality = Math.max(0.5, quality - 0.08);
    width *= 0.88;
    height *= 0.88;
    candidate = await canvasToJpegFile(image, file, width, height, quality);
    attempts += 1;
  }

  return candidate.size < file.size ? candidate : file;
}

async function postProductImage(productId: number, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await apiClient.post<{ data?: { imagePath?: string }; message?: string }>(
    `/api/products/${productId}/images`,
    formData,
  );
  const imagePath = data.data?.imagePath;
  if (imagePath) return imagePath;
  throw new Error(data.message ?? 'Не удалось загрузить изображение');
}

/** Список своих продуктов (для поставщика — только свои). Бэкенд: { data: Product[], pagination }. */
export async function getProducts(params: ProductsListParams = {}): Promise<ProductsListResponse> {
  const { page = 1, limit = 10, moderationStatus } = params;
  const { data } = await apiClient.get<{ status?: string; data?: Product[]; pagination?: ProductsListResponse['pagination'] }>(
    '/api/products',
    { params: { page, limit, ...(moderationStatus ? { moderationStatus } : {}) } }
  );
  return {
    data: data.data ?? [],
    pagination: data.pagination ?? { currentPage: page, totalPages: 1, totalItems: 0 },
  };
}

/** Один продукт по ID. */
export async function getProductById(id: number): Promise<Product> {
  const { data } = await apiClient.get<ApiResponse<Product>>(`/api/products/${id}`);
  if (data.data) return data.data;
  throw new Error(data.message ?? 'Продукт не найден');
}

/** Создание продукта без изображений; изображения догружаются отдельными запросами. */
export async function createProduct(payload: Record<string, unknown>): Promise<Product> {
  const { data } = await apiClient.post<ProductMutationResponse>('/api/products', payload);
  const product = extractProductFromMutationResponse(data);
  if (product) return product;
  throw new Error(data.message ?? 'Не удалось создать продукт');
}

/** Обновление продукта. multipart/form-data. При изменении продукт снова уходит на модерацию. */
export async function updateProduct(id: number, formData: FormData): Promise<Product> {
  const { data } = await apiClient.put<ProductMutationResponse>(`/api/products/${id}`, formData);
  const product = extractProductFromMutationResponse(data);
  if (product) return product;
  throw new Error(data.message ?? 'Не удалось обновить продукт');
}

/** Загрузка одного изображения для уже созданного продукта. */
export async function uploadProductImage(productId: number, file: File): Promise<string> {
  const optimizedFile = await optimizeImageForUpload(file, DEFAULT_MAX_IMAGE_BYTES);

  try {
    return await postProductImage(productId, optimizedFile);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 413) {
      throw error;
    }

    const fallbackFile = await optimizeImageForUpload(file, FALLBACK_MAX_IMAGE_BYTES);
    return await postProductImage(productId, fallbackFile);
  }
}

/** Удаление продукта. */
export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/api/products/${id}`);
}

export interface ModerateProductApprove {
  action: 'approve';
  price: number;
  boxPrice?: number;
  reason?: string;
}

export interface ModerateProductReject {
  action: 'reject';
  reason: string;
}

export type ModerateProductPayload = ModerateProductApprove | ModerateProductReject;

/** Модерация продукта (только ADMIN). */
export async function moderateProduct(id: number, payload: ModerateProductPayload): Promise<Product> {
  const { data } = await apiClient.patch<{ status?: string; data?: { product: Product }; message?: string }>(
    `/api/products/${id}/moderate`,
    payload,
  );
  if (data.data?.product) return data.data.product;
  throw new Error(data.message ?? 'Не удалось выполнить модерацию');
}

/** Список категорий для формы продукта. Бэкенд: { data: { categories: Category[] } }. */
export async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get<{ status?: string; data?: { categories?: Category[] }; categories?: Category[] }>('/api/categories');
    const list = data?.data?.categories ?? data?.categories ?? data?.data;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
