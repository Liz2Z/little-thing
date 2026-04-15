import { settings } from "../settings/index.js";

export type PermissionAction = "allow" | "ask" | "deny";

export interface PermissionContext {
  toolName: string;
  cwd?: string;
  sessionId?: string;
}

export interface PermissionDecision {
  action: PermissionAction;
  reason: string;
}

function matchRule(
  rule: {
    tool: string;
    action: PermissionAction;
    cwd?: string;
    sessionId?: string;
  },
  context: PermissionContext,
): boolean {
  if (rule.tool !== context.toolName && rule.tool !== "*") {
    return false;
  }

  if (rule.cwd && context.cwd && rule.cwd !== context.cwd) {
    return false;
  }

  if (
    rule.sessionId &&
    context.sessionId &&
    rule.sessionId !== context.sessionId
  ) {
    return false;
  }

  if (rule.cwd && !context.cwd) {
    return false;
  }

  if (rule.sessionId && !context.sessionId) {
    return false;
  }

  return true;
}

export class ToolPermissionService {
  private grants = new Set<string>();

  allowOnce(context: PermissionContext): void {
    this.grants.add(this.toGrantKey(context));
  }

  resolve(context: PermissionContext): PermissionDecision {
    if (this.grants.has(this.toGrantKey(context))) {
      return { action: "allow", reason: "granted_in_memory" };
    }

    const toolsSettings = settings.tools.get();
    const matched = toolsSettings.rules.find((rule) =>
      matchRule(rule, context),
    );

    if (matched) {
      return {
        action: matched.action,
        reason: "matched_rule",
      };
    }

    return {
      action: toolsSettings.defaultAction,
      reason: "default_action",
    };
  }

  private toGrantKey(context: PermissionContext): string {
    const cwd = context.cwd ?? "*";
    const sessionId = context.sessionId ?? "*";
    return `${cwd}::${sessionId}::${context.toolName}`;
  }
}
