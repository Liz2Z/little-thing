export * from './base';

import type { Context } from 'hono';
import { AppError } from './base';

class UnhandledInternalError extends AppError {
  constructor(details: Record<string, unknown>) {
    super(['INTERNAL:UNHANDLED', 500, '服务器内部错误'] as const, details);
  }
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 200 | 400 | 401 | 403 | 404 | 408 | 429 | 500);
  }

  console.error('Unhandled error:', err);

  const internalError = new UnhandledInternalError({
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      originalMessage: err.message,
    }),
  });

  return c.json(internalError.toJSON(), internalError.status as 500);
}
