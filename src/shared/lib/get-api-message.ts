/**
 * Извлечение сообщения об ошибке из ответа API.
 */
export function getApiMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as {
      response?: {
        data?: {
          message?: string;
          errors?: Array<{ msg?: string; message?: string }>;
        };
      };
    }).response;
    const data = res?.data;
    const msg = data?.message;
    if (typeof msg === 'string') return msg;
    const errors = data?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const msgs = errors.map((e) => e.message ?? e.msg).filter(Boolean);
      if (msgs.length > 0) return msgs.join('; ');
    }
  }
  if (error instanceof Error) return error.message;
  return 'Произошла ошибка';
}
