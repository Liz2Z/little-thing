export const SessionErrors = {
  NOT_FOUND: ['SESSION-1001', 404, '会话不存在'] as const,
  OR_MESSAGE_NOT_FOUND: ['SESSION-1002', 404, '会话或消息不存在'] as const,
};

export const AgentErrors = {
  MAX_ITERATIONS: ['AGENT-1001', 200, '达到最大迭代次数'] as const,
  ABORTED: ['AGENT-1002', 200, 'Agent 被中断'] as const,
};

export const ToolErrors = {
  FILE_NOT_FOUND: ['TOOL-1001', 400, '文件不存在'] as const,
  PERMISSION_DENIED: ['TOOL-1002', 403, '权限不足'] as const,
  INVALID_PATH: ['TOOL-1003', 400, '路径不合法'] as const,
  TIMEOUT: ['TOOL-1004', 408, '操作超时'] as const,
  NOT_FOUND: ['TOOL-1005', 400, '工具不存在'] as const,
  ABORTED: ['TOOL-1006', 200, '操作被中断'] as const,
  NOT_A_DIRECTORY: ['TOOL-1007', 400, '不是目录'] as const,
  OLD_TEXT_NOT_FOUND: ['TOOL-1008', 400, '未找到要替换的文本'] as const,
  OLD_TEXT_MULTIPLE: ['TOOL-1009', 400, '要替换的文本出现多次'] as const,
  OFFSET_BEYOND_END: ['TOOL-1010', 400, '偏移量超出文件范围'] as const,
  EXECUTION_FAILED: ['TOOL-1011', 500, '工具执行失败'] as const,
};

export const LlmErrors = {
  RATE_LIMITED: ['LLM-1001', 429, 'API 请求频率限制'] as const,
  CONTEXT_TOO_LONG: ['LLM-1002', 400, '上下文长度超限'] as const,
  PARSE_FAILED: ['LLM-1003', 500, '响应解析失败'] as const,
  UNAUTHORIZED: ['LLM-1004', 401, 'API 密钥无效'] as const,
  API_ERROR: ['LLM-1005', 500, 'LLM API 错误'] as const,
};

export const ConfigErrors = {
  NOT_LOADED: ['CONFIG-1001', 500, '服务器配置未加载'] as const,
  INVALID: ['CONFIG-1002', 500, '服务器配置无效'] as const,
};

export const ProviderErrors = {
  UNKNOWN_PROVIDER: ['PROVIDER-1001', 404, 'Provider 不存在'] as const,
  MISSING_API_KEY: ['PROVIDER-1002', 500, 'Provider API Key 未配置'] as const,
  API_ERROR: ['PROVIDER-1003', 502, 'Provider API 返回错误'] as const,
};

export const InternalErrors = {
  ERROR: ['INTERNAL-1001', 500, '服务器内部错误'] as const,
  UNSUPPORTED_SDK: ['INTERNAL-1002', 500, '不支持的 SDK 类型'] as const,
};

export type ErrorTuple = readonly [code: string, status: number, message: string];

export type ErrorCode =
  | typeof SessionErrors[keyof typeof SessionErrors][0]
  | typeof AgentErrors[keyof typeof AgentErrors][0]
  | typeof ToolErrors[keyof typeof ToolErrors][0]
  | typeof LlmErrors[keyof typeof LlmErrors][0]
  | typeof ConfigErrors[keyof typeof ConfigErrors][0]
  | typeof ProviderErrors[keyof typeof ProviderErrors][0]
  | typeof InternalErrors[keyof typeof InternalErrors][0];

export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, unknown>;
}
