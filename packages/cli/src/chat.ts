import * as readline from 'readline';
import { ApiClient, type Session, type AgentEvent, type ToolUseEvent } from './api.js';
import type { CliConfig } from './config.js';

let activeSessionId: string | null = null;
let currentRunId: string | null = null;

export async function startInteractiveChat(config: CliConfig) {
  const client = new ApiClient(config);

  try {
    const health = await client.health();
    console.log(`✓ Connected to server (${health.model})`);
  } catch {
    console.error('✗ Cannot connect to server at', config.serverUrl);
    console.error('  Make sure the server is running: bun run dev:server');
    process.exit(1);
  }

  let session: Session;
  if (config.activeSessionId) {
    try {
      session = await client.getSession(config.activeSessionId);
      activeSessionId = config.activeSessionId;
    } catch {
      const meta = await client.createSession();
      session = { ...meta, messages: [] };
      activeSessionId = meta.id;
    }
  } else {
    const meta = await client.createSession();
    session = { ...meta, messages: [] };
    activeSessionId = meta.id;
  }

  console.log(`\n🤖 little thing - ${session.name}\n`);
  console.log('Type your message and press Enter.');
  console.log('Commands: /new, /list, /switch, /delete, /rename, /clear, /abort, /quit\n');

  if (session.messages.length > 0) {
    console.log('--- 历史消息 ---');
    for (const msg of session.messages) {
      if (msg.role === 'user') {
        console.log(`You: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        console.log(`AI: ${msg.content}\n`);
      }
    }
    console.log('--- 新消息 ---\n');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.startsWith('/')) {
        handleCommand(trimmed, client, config).then((handled) => {
          if (handled === 'quit') {
            console.log('\nGoodbye! 👋');
            rl.close();
          } else {
            askQuestion();
          }
        });
        return;
      }

      (async () => {
        try {
          if (!activeSessionId) {
            console.log('No active session');
            askQuestion();
            return;
          }

          process.stdout.write('AI: ');

          for await (const event of client.agentChat(activeSessionId, trimmed)) {
            renderEvent(event);
          }

          console.log('');
        } catch (error) {
          console.error('\n✗ Error:', error instanceof Error ? error.message : 'Unknown error');
        }

        askQuestion();
      })();
    });
  };

  askQuestion();
}

function renderEvent(event: AgentEvent) {
  switch (event.type) {
    case 'agent_start':
      currentRunId = event.run_id;
      break;

    case 'agent_thinking':
      process.stdout.write(`\r💭 ${event.content.slice(0, 50)}${event.content.length > 50 ? '...' : ''}\n`);
      break;

    case 'tool_use':
      renderToolUse(event);
      break;

    case 'agent_content':
      process.stdout.write(`\r${event.content}`);
      break;

    case 'agent_complete':
      currentRunId = null;
      break;

    case 'agent_error':
      console.log(`\n❌ Error: ${event.error}`);
      currentRunId = null;
      break;

    case 'agent_abort':
      console.log(`\n🛑 Aborted: ${event.reason}`);
      currentRunId = null;
      break;
  }
}

function renderToolUse(event: ToolUseEvent) {
  if (event.status === 'start') {
    process.stdout.write(`\n🔧 ${event.tool_name}...`);
  } else if (event.status === 'completed') {
    process.stdout.write(` ✓ (${event.duration_ms}ms)\n`);
    if (event.result) {
      const preview = event.result.slice(0, 100);
      process.stdout.write(`   ${preview}${event.result.length > 100 ? '...' : ''}\n`);
    }
  } else if (event.status === 'failed') {
    process.stdout.write(` ✗\n`);
    process.stdout.write(`   Error: ${event.error}\n`);
  }
}

async function handleCommand(
  input: string,
  client: ApiClient,
  config: CliConfig
): Promise<'quit' | 'continue'> {
  const parts = input.split(' ');
  const command = parts[0];
  const args = parts.slice(1);

  switch (command) {
    case '/quit':
    case '/exit':
      return 'quit';

    case '/clear':
      console.clear();
      return 'continue';

    case '/abort': {
      if (!activeSessionId || !currentRunId) {
        console.log('No active agent run to abort');
        return 'continue';
      }
      const success = await client.abortAgent(activeSessionId, currentRunId);
      if (success) {
        console.log('✓ Agent aborted');
      } else {
        console.log('✗ Failed to abort agent');
      }
      return 'continue';
    }

    case '/new': {
      const name = args.join(' ') || undefined;
      const session = await client.createSession(name);
      activeSessionId = session.id;
      console.log(`✓ Created new session: ${session.name} (${session.id})`);
      return 'continue';
    }

    case '/list': {
      const sessions = await client.listSessions();

      if (sessions.length === 0) {
        console.log('No sessions yet. Use /new to create one.');
        return 'continue';
      }

      console.log('\nSessions:');
      for (const s of sessions) {
        const marker = s.id === activeSessionId ? '→ ' : '  ';
        console.log(`${marker}${s.name} (${s.id}) - ${s.messageCount} messages`);
      }
      console.log('');
      return 'continue';
    }

    case '/switch': {
      const sessionId = args[0];
      if (!sessionId) {
        console.log('Usage: /switch <session-id>');
        return 'continue';
      }

      try {
        const session = await client.getSession(sessionId);
        activeSessionId = sessionId;
        console.log(`✓ Switched to: ${session.name}`);
        if (session.messages.length > 0) {
          console.log('\n--- 历史消息 ---');
          for (const msg of session.messages) {
            if (msg.role === 'user') {
              console.log(`You: ${msg.content}`);
            } else if (msg.role === 'assistant') {
              console.log(`AI: ${msg.content}\n`);
            }
          }
          console.log('---\n');
        }
      } catch {
        console.log('✗ Session not found');
      }
      return 'continue';
    }

    case '/delete': {
      const deleteId = args[0];
      if (!deleteId) {
        console.log('Usage: /delete <session-id>');
        return 'continue';
      }

      try {
        await client.deleteSession(deleteId);
        if (activeSessionId === deleteId) {
          activeSessionId = null;
        }
        console.log('✓ Session deleted');
      } catch {
        console.log('✗ Session not found');
      }
      return 'continue';
    }

    case '/rename': {
      const newName = args.join(' ');
      if (!newName) {
        console.log('Usage: /rename <new-name>');
        return 'continue';
      }

      if (!activeSessionId) {
        console.log('No active session');
        return 'continue';
      }

      try {
        await client.renameSession(activeSessionId, newName);
        console.log(`✓ Renamed to: ${newName}`);
      } catch {
        console.log('✗ Failed to rename');
      }
      return 'continue';
    }

    case '/help':
      console.log('\nCommands:');
      console.log('  /new [name]    - Create new session');
      console.log('  /list          - List all sessions');
      console.log('  /switch <id>   - Switch to session');
      console.log('  /delete <id>   - Delete session');
      console.log('  /rename <name> - Rename current session');
      console.log('  /clear         - Clear screen');
      console.log('  /abort         - Abort current agent run');
      console.log('  /quit, /exit   - Exit');
      console.log('');
      return 'continue';

    default:
      console.log(`Unknown command: ${command}. Type /help for available commands.`);
      return 'continue';
  }
}
