import { Settings } from "./core";
import { settingsSchema } from "./schemas";

export * from "./core";
export * from "./errors";
export * from "./schemas";

// 管理类实例
const manager = new Settings("littlething", settingsSchema);

manager.load();

/**
 * 此时导出的 settings 是一个占位符，真正的数据在 loadConfig 后生效
 * 但是由于 Proxy 的延迟执行特性，我们可以直接导出通过 manager 获取的 accessor
 */
export const settings = manager.getAccessor();

/**
 * 重新加载配置
 */
export function reloadConfig() {
  manager.load();
}
