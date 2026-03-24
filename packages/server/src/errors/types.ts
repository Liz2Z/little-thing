import type { ErrorTuple, ErrorResponse } from './codes';

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple[2]);
    this.name = 'AppError';
    this.code = tuple[0];
    this.status = tuple[1];
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'ForbiddenError';
  }
}

export class InternalError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'InternalError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
