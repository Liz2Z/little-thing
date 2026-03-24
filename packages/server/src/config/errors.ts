export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends ConfigError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CredentialsError extends ConfigError {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialsError';
  }
}
