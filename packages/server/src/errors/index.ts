export * from './codes';
export * from './types';

import type { Context } from 'hono';
import { AppError, InternalError } from './types';
import { InternalErrors } from './codes';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 200 | 400 | 401 | 403 | 404 | 408 | 429 | 500);
  }

  console.error('Unhandled error:', err);

  const internalError = new InternalError(InternalErrors.ERROR, {
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      originalMessage: err.message,
    }),
  });

  return c.json(internalError.toJSON(), internalError.status as 500);
}
