export { SessionService } from './service.js';
export type { Session, SessionMeta } from './session.schema.js';
export type { Message, MessageContent } from './message.js';
export { toCoreMessages } from './convert.js';

import { SessionStore } from './store.js';
import { ToolRegistry } from '../tools/registry.js';
import { createAllTools } from '../tools/index.js';
import { SessionService } from './service.js';

export function createSessionService(cwd: string): SessionService {
  const sessionStore = new SessionStore();
  const toolRegistry = new ToolRegistry();
  const allTools = createAllTools(cwd);
  for (const tool of Object.values(allTools)) {
    toolRegistry.register(tool);
  }

  return new SessionService(sessionStore, toolRegistry);
}
