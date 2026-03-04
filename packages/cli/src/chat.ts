import * as readline from 'readline';
import { ApiClient, type Session } from './api.js';
import type { CliConfig } from './config.js';

let activeSessionId: string | null = null;

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

  console.log(`\n🤖 Agent Chat - ${session.name}\n`);
  console.log('Type your message and press Enter.');
  console.log('Commands: /new, /list, /switch, /delete, /rename, /clear, /quit\n');

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

      // 处理命令
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

      // 发送消息
      (async () => {
        try {
          console.log(`[DEBUG] activeSessionId: ${activeSessionId}`);
          if (!activeSessionId) {
            console.log('No active session');
            askQuestion();
            return;
          }

          console.log(`[DEBUG] Calling chatInSession with: ${trimmed}`);
          // 使用非流式 API (暂时)
          const response = await client.chatInSession(activeSessionId, trimmed);
          console.log(`[DEBUG] Got response: ${response.substring(0, 50)}...`);
          console.log(`AI: ${response}`);
        } catch (error) {
          console.error('\n✗ Error:', error instanceof Error ? error.message : 'Unknown error');
        }

        askQuestion();
      })();
    });
  };

  askQuestion();
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
      console.log('  /quit, /exit   - Exit');
      console.log('');
      return 'continue';

    default:
      console.log(`Unknown command: ${command}. Type /help for available commands.`);
      return 'continue';
  }
}
