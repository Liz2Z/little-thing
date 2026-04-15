import { InternalError, NotFoundError, ValidationError } from "../lib/error.js";

export class CommandUsageError extends ValidationError {
  readonly commandKey: string;

  constructor(
    commandKey: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(["CLI:INVALID_USAGE", 400, message] as const, details);
    this.commandKey = commandKey;
    Object.setPrototypeOf(this, CommandUsageError.prototype);
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super(["CLI:SESSION_NOT_FOUND", 404, "会话不存在"] as const, {
      sessionId,
    });
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}

export class MessageNotFoundError extends NotFoundError {
  constructor(sessionId: string, messageId: string) {
    super(["CLI:MESSAGE_NOT_FOUND", 404, "消息不存在"] as const, {
      sessionId,
      messageId,
    });
    Object.setPrototypeOf(this, MessageNotFoundError.prototype);
  }
}

export class CliUnhandledError extends InternalError {
  constructor(cause: unknown) {
    super(["CLI:UNHANDLED", 500, "CLI 内部错误"] as const, {
      cause:
        cause instanceof Error
          ? {
              message: cause.message,
              stack: cause.stack,
            }
          : { cause: String(cause) },
    });
    Object.setPrototypeOf(this, CliUnhandledError.prototype);
  }
}
