import type { CoreMessage } from 'ai';
import type { Message, MessageContent, ToolUseContent, ToolResultContent } from './types.js';

/**
 * 将内部 Message 格式转换为 AI SDK 的 CoreMessage 格式
 * @param messages - 内部消息数组
 * @returns AI SDK CoreMessage 数组
 */
export function toCoreMessages(messages: Message[]): CoreMessage[] {
  return messages.map((msg) => convertMessage(msg));
}

/**
 * 转换单个消息
 * @param message - 内部消息
 * @returns AI SDK CoreMessage
 */
function convertMessage(message: Message): CoreMessage {
  const { role, content } = message;

  // 处理字符串内容
  if (typeof content === 'string') {
    return { role: role as 'user' | 'assistant' | 'system', content };
  }

  // 处理数组内容（tool_use 或 tool_result）
  if (Array.isArray(content)) {
    return {
      role: role as 'user' | 'assistant',
      content: content.map((item) => convertContentItem(item)),
    };
  }

  // 默认返回字符串内容
  return { role: role as 'user' | 'assistant' | 'system', content: '' };
}

/**
 * 转换内容项
 * @param item - 内容项（tool_use 或 tool_result）
 * @returns AI SDK 内容项
 */
function convertContentItem(item: ToolUseContent | ToolResultContent): any {
  switch (item.type) {
    case 'tool_use':
      return {
        type: 'tool-use',
        toolCallId: item.id,
        toolName: item.name,
        args: item.input,
      };

    case 'tool_result':
      return {
        type: 'tool-result',
        toolCallId: item.tool_use_id,
        content: item.content,
        isError: item.is_error ?? false,
      };

    default:
      return { type: 'text', text: '' };
  }
}

/**
 * 获取消息的文本内容
 * @param content - 消息内容
 * @returns 文本内容
 */
export function getTextContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((item): item is ToolUseContent => item.type === 'tool_use')
      .map((item) => `${item.name}(${JSON.stringify(item.input)})`)
      .join('\n');
  }

  return '';
}
