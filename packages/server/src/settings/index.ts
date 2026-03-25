import { Settings, Accessor } from './core';
import { settingsSchema } from './schemas';

export * from './core';
export * from './schemas';
export * from './errors';

// 管理类实例
const manager = new Settings('littlething', settingsSchema);

/**
 * 此时导出的 settings 是一个占位符，真正的数据在 loadConfig 后生效
 * 但是由于 Proxy 的延迟执行特性，我们可以直接导出通过 manager 获取的 accessor
 */
export const settings = manager.getAccessor();

/**
 * 加载所有配置（同步加载，但为了兼容性保留 async）
 */
export async function loadConfig(): Promise<void> {
  manager.load();
}

/**
 * 重新加载配置
 */
export function reloadConfig(): Promise<void> {
  return loadConfig();
}
