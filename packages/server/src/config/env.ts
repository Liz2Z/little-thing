import { CredentialsError } from './errors';

const ENV_VAR_PATTERN = /\$\{([^}:]+)(?::-([^}]*))?\}/g;

/**
 * 环境变量解析规则：
 * 1. `${VAR}`：必需的环境变量，不存在时抛出错误
 * 2. `${VAR:-default}`：可选的环境变量，不存在时使用默认值
 * 3. `$$`：转义，输出字面量 `$`
 * 4. 不支持的语法：嵌套引用、条件值、命令替换
 */
export function expandEnvVar(value: string): string {
  // 先处理转义的 $$
  const escaped = value.replace(/\$\$/g, '__ESCAPED_DOLLAR__');

  const expanded = escaped.replace(ENV_VAR_PATTERN, (_, varName, defaultValue) => {
    if (process.env[varName] !== undefined) {
      return process.env[varName]!;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new CredentialsError(`Environment variable not found: ${varName}`);
  });

  return expanded.replace(/__ESCAPED_DOLLAR__/g, '$');
}

/**
 * 递归展开对象中的所有字符串字段中的环境变量
 */
export function expandEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return expandEnvVar(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value);
    }
    return result as T;
  }

  return obj;
}
