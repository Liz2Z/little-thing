export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigNotLoadedError extends ConfigError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigNotLoadedError';
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
