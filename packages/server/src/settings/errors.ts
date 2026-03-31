import { AppError } from "../lib/error.js";

export class ConfigError extends AppError {
  constructor(
    messageOrDetails: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const finalDetails =
      typeof messageOrDetails === "string" ? (details ?? {}) : messageOrDetails;
    const message =
      typeof messageOrDetails === "string" ? messageOrDetails : "配置错误";
    super(["CONFIG:ERROR", 500, message] as const, finalDetails);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class ConfigNotLoadedError extends AppError {
  constructor(
    messageOrDetails: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const finalDetails =
      typeof messageOrDetails === "string" ? (details ?? {}) : messageOrDetails;
    const message =
      typeof messageOrDetails === "string" ? messageOrDetails : "配置未加载";
    super(["CONFIG:NOT_LOADED", 500, message] as const, finalDetails);
    this.name = "ConfigNotLoadedError";
    Object.setPrototypeOf(this, ConfigNotLoadedError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(
    messageOrDetails: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const finalDetails =
      typeof messageOrDetails === "string" ? (details ?? {}) : messageOrDetails;
    const message =
      typeof messageOrDetails === "string" ? messageOrDetails : "配置验证失败";
    super(["CONFIG:VALIDATION", 400, message] as const, finalDetails);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class CredentialsError extends AppError {
  constructor(
    messageOrDetails: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const finalDetails =
      typeof messageOrDetails === "string" ? (details ?? {}) : messageOrDetails;
    const message =
      typeof messageOrDetails === "string" ? messageOrDetails : "凭证错误";
    super(["CONFIG:CREDENTIALS", 401, message] as const, finalDetails);
    this.name = "CredentialsError";
    Object.setPrototypeOf(this, CredentialsError.prototype);
  }
}
