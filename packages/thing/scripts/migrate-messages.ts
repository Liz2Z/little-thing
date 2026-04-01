#!/usr/bin/env bun
/**
 * 消息数据迁移脚本
 * 为所有现有消息添加 ID 字段
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR = join(homedir(), '.local', 'share', 'littlething');
const SESSIONS_DIR = join(DATA_DIR, 'sessions');

function generateMessageId(): string {
  return `msg_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function migrateSessionMessages(sessionFile: string): number {
  const filePath = join(SESSIONS_DIR, sessionFile);

  if (!existsSync(filePath)) {
    return 0;
  }

  // 只处理 .jsonl 文件
  if (!sessionFile.endsWith('.jsonl')) {
    return 0;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      return 0;
    }

    let migratedCount = 0;
    const newLines: string[] = [];

    for (const line of lines) {
      try {
        const msg: Message = JSON.parse(line);
        if (!msg.id) {
          msg.id = generateMessageId();
          migratedCount++;
        }
        newLines.push(JSON.stringify(msg));
      } catch {
        // 解析失败的行保持原样
        newLines.push(line);
      }
    }

    if (migratedCount > 0) {
      writeFileSync(filePath, newLines.join('\n') + '\n');
      console.log(`✓ Migrated ${migratedCount} messages in ${sessionFile}`);
    } else {
      console.log(`✓ No migration needed for ${sessionFile}`);
    }

    return migratedCount;
  } catch (error) {
    console.error(`✗ Failed to migrate ${sessionFile}:`, error);
    return 0;
  }
}

function main() {
  console.log('Starting message migration...\n');

  if (!existsSync(SESSIONS_DIR)) {
    console.log('No sessions directory found. Nothing to migrate.');
    process.exit(0);
  }

  const files = readdirSync(SESSIONS_DIR);
  const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

  if (jsonlFiles.length === 0) {
    console.log('No message files found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${jsonlFiles.length} session files to check.\n`);

  let totalMigrated = 0;

  for (const file of jsonlFiles) {
    const count = migrateSessionMessages(file);
    totalMigrated += count;
  }

  console.log(`\nMigration complete! Total messages migrated: ${totalMigrated}`);
}

main();
