import type { CoreMessage } from 'ai';
import type { Message, MessageContent, TextContent, ToolUseContent, ToolResultContent } from './message.schema.js';

export function toCoreMessages(messages: Message[]): CoreMessage[] {
  return messages.map((msg) => convertMessage(msg));
}

function convertMessage(message: Message): CoreMessage {
  const { role, content } = message;

  switch (content.type) {
    case 'text':
      return { role: role as 'user' | 'assistant' | 'system', content: content.text };
    case 'tool_use':
      return {
        role: role as 'assistant',
        content: [convertToolUseContent(content)],
      };
    case 'tool_result':
      return {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: content.tool_use_id,
            toolName: '',
            output: { type: 'text', value: content.content },
          },
        ],
      };
    default:
      return { role: role as 'user' | 'assistant' | 'system', content: '' };
  }
}

function convertToolUseContent(item: ToolUseContent): any {
  return {
    type: 'tool-use',
    toolCallId: item.id,
    toolName: item.name,
    args: item.input,
  };
}

export function getTextContent(content: MessageContent): string {
  if (content.type === 'text') {
    return content.text;
  }

  if (content.type === 'tool_use') {
    return `${content.name}(${JSON.stringify(content.input)})`;
  }

  if (content.type === 'tool_result') {
    return content.content;
  }

  return '';
}
