#!/usr/bin/env bun

import { loadConfig, saveConfig, getConfigPath } from './config.js';
import { startInteractiveChat } from './chat.js';
import { ApiClient } from './api.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const config = loadConfig();

  switch (command) {
    case 'config':
      handleConfig(args.slice(1));
      break;

    case 'sessions':
      await handleSessions(args.slice(1), config);
      break;

    case 'chat':
    case undefined:
      await startInteractiveChat(config);
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

function handleConfig(args: string[]) {
  const subCommand = args[0];

  if (subCommand === 'set' && args.length >= 3) {
    const key = args[1] as 'serverUrl' | 'apiKey' | 'model' | 'activeSessionId';
    const value = args[2];
    saveConfig({ [key]: value });
    console.log(`Set ${key} = ${value}`);
  } else if (subCommand === 'get') {
    const config = loadConfig();
    console.log('Config file:', getConfigPath());
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log('Usage:');
    console.log('  agent config get           - Show current config');
    console.log('  agent config set <key> <value>  - Set config value');
    console.log('');
    console.log('Keys: serverUrl, apiKey, model, activeSessionId');
  }
}

async function handleSessions(args: string[], config: { serverUrl: string }) {
  const client = new ApiClient(config);
  const subCommand = args[0];

  switch (subCommand) {
    case 'list':
    case 'ls': {
      try {
        const sessions = await client.listSessions();

        if (sessions.length === 0) {
          console.log('No sessions yet.');
          return;
        }

        console.log('Sessions:');
        for (const s of sessions) {
          console.log(`  ${s.name} (${s.id}) - ${s.messageCount} messages`);
        }
      } catch {
        console.error('Failed to list sessions');
      }
      break;
    }

    case 'new': {
      try {
        const name = args.slice(1).join(' ') || undefined;
        const session = await client.createSession(name);
        console.log(`Created: ${session.name} (${session.id})`);
      } catch {
        console.error('Failed to create session');
      }
      break;
    }

    case 'switch': {
      const id = args[1];
      if (!id) {
        console.log('Usage: agent sessions switch <session-id>');
        return;
      }
      try {
        await client.getSession(id);
        saveConfig({ activeSessionId: id });
        console.log(`Switched to: ${id}`);
      } catch {
        console.log('Session not found');
      }
      break;
    }

    case 'delete': {
      const id = args[1];
      if (!id) {
        console.log('Usage: agent sessions delete <session-id>');
        return;
      }
      try {
        await client.deleteSession(id);
        console.log('Session deleted');
      } catch {
        console.log('Session not found');
      }
      break;
    }

    default:
      console.log('Usage:');
      console.log('  agent sessions list           - List all sessions');
      console.log('  agent sessions new [name]     - Create new session');
      console.log('  agent sessions switch <id>    - Switch to session');
      console.log('  agent sessions delete <id>    - Delete session');
  }
}

function showHelp() {
  console.log('Agent CLI\n');
  console.log('Commands:');
  console.log('  agent                    - Start interactive chat');
  console.log('  agent chat               - Start interactive chat');
  console.log('  agent config get         - Show config');
  console.log('  agent config set         - Set config value');
  console.log('  agent sessions list      - List sessions');
  console.log('  agent sessions new       - Create session');
  console.log('  agent sessions switch    - Switch session');
  console.log('  agent help               - Show this help');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
