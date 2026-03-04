#!/usr/bin/env bun
/**
 * 数据迁移脚本：从 agent-cli 迁移到 littlething
 * 迁移内容：
 * - 配置文件: ~/.config/agent-cli/config.json → ~/.config/littlething/config.json
 * - 会话数据: ~/.local/share/agent-cli/sessions/ → ~/.local/share/littlething/sessions/
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

// 旧路径
const OLD_CONFIG_DIR = join(homedir(), '.config', 'agent-cli');
const OLD_CONFIG_FILE = join(OLD_CONFIG_DIR, 'config.json');
const OLD_DATA_DIR = join(homedir(), '.local', 'share', 'agent-cli');
const OLD_SESSIONS_DIR = join(OLD_DATA_DIR, 'sessions');

// 新路径
const NEW_CONFIG_DIR = join(homedir(), '.config', 'littlething');
const NEW_CONFIG_FILE = join(NEW_CONFIG_DIR, 'config.json');
const NEW_DATA_DIR = join(homedir(), '.local', 'share', 'littlething');
const NEW_SESSIONS_DIR = join(NEW_DATA_DIR, 'sessions');

interface MigrationResult {
  config: { success: boolean; message: string };
  sessions: { success: boolean; message: string; count?: number };
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`  创建目录: ${dir}`);
  }
}

function migrateConfig(): { success: boolean; message: string } {
  console.log('\n📄 迁移配置文件...');

  if (!existsSync(OLD_CONFIG_FILE)) {
    return { success: false, message: '旧配置文件不存在，跳过' };
  }

  try {
    // 读取旧配置
    const configContent = readFileSync(OLD_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configContent);

    // 确保新目录存在
    ensureDir(NEW_CONFIG_DIR);

    // 写入新配置
    writeFileSync(NEW_CONFIG_FILE, JSON.stringify(config, null, 2));

    return { success: true, message: `配置已迁移到 ${NEW_CONFIG_FILE}` };
  } catch (error) {
    return {
      success: false,
      message: `迁移失败: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function migrateSessions(): { success: boolean; message: string; count?: number } {
  console.log('\n💾 迁移会话数据...');

  if (!existsSync(OLD_SESSIONS_DIR)) {
    return { success: false, message: '旧会话目录不存在，跳过' };
  }

  try {
    // 确保新目录存在
    ensureDir(NEW_SESSIONS_DIR);

    // 获取所有会话文件
    const files = readdirSync(OLD_SESSIONS_DIR);
    const sessionFiles = files.filter(f => f.endsWith('.jsonl') || f === 'index.json');

    if (sessionFiles.length === 0) {
      return { success: false, message: '没有会话文件需要迁移' };
    }

    let migratedCount = 0;
    for (const file of sessionFiles) {
      const oldPath = join(OLD_SESSIONS_DIR, file);
      const newPath = join(NEW_SESSIONS_DIR, file);

      // 检查是否是文件
      const stat = statSync(oldPath);
      if (!stat.isFile()) continue;

      // 复制文件
      copyFileSync(oldPath, newPath);
      migratedCount++;
      console.log(`  ✓ ${file}`);
    }

    return {
      success: true,
      message: `已迁移 ${migratedCount} 个会话文件到 ${NEW_SESSIONS_DIR}`,
      count: migratedCount
    };
  } catch (error) {
    return {
      success: false,
      message: `迁移失败: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function main(): void {
  console.log('🚀 开始数据迁移: agent-cli → littlething');
  console.log('=' .repeat(50));

  const result: MigrationResult = {
    config: migrateConfig(),
    sessions: migrateSessions()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 迁移结果:');

  if (result.config.success) {
    console.log(`  ✅ 配置: ${result.config.message}`);
  } else {
    console.log(`  ⚠️  配置: ${result.config.message}`);
  }

  if (result.sessions.success) {
    console.log(`  ✅ 会话: ${result.sessions.message}`);
  } else {
    console.log(`  ⚠️  会话: ${result.sessions.message}`);
  }

  // 检查是否有任何成功迁移
  if (result.config.success || result.sessions.success) {
    console.log('\n✨ 迁移完成！');
    console.log('\n你可以安全地删除旧数据:');
    if (result.config.success) {
      console.log(`  rm -rf ${OLD_CONFIG_DIR}`);
    }
    if (result.sessions.success) {
      console.log(`  rm -rf ${OLD_DATA_DIR}`);
    }
  } else {
    console.log('\n⚠️ 没有数据需要迁移（可能是首次安装或已迁移过）');
  }
}

main();
