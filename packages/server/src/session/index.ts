export { SessionService,  } from './service.js';
export type { Session, SessionMeta, Message, MessageContent } from './types.js';

import { SessionStore } from './store.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { ToolRegistry } from '../tools/registry.js';
import { createAllTools } from '../tools/index.js';
import { SessionService } from './service.js';
import { Agent } from '../agent/agent.js';

export function createSessionService(cwd: string): SessionService {
  const sessionStore = new SessionStore();

  const provider = new AnthropicProvider();
  const toolRegistry = new ToolRegistry();
  const allTools = createAllTools(cwd);
  for (const tool of Object.values(allTools)) {
    toolRegistry.register(tool);
  }
  const agent = new Agent(provider, toolRegistry);

  return new SessionService(sessionStore, agent);
}
