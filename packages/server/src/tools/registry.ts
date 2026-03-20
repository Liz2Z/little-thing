import type { AnyTool } from './types.js';
import type { ToolDefinition } from '../providers/types.js';
import { toolToProviderFormat } from './types.js';

export interface ToolExecutor {
  execute(name: string, input: unknown): Promise<{ success: boolean; output?: string; error?: string }>;
  getDefinition(name: string): ToolDefinition | undefined;
  getAllDefinitions(): ToolDefinition[];
}

export class ToolRegistry implements ToolExecutor {
  private tools: Map<string, AnyTool> = new Map();

  register(tool: AnyTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AnyTool[] {
    return Array.from(this.tools.values());
  }

  getDefinition(name: string): ToolDefinition | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;
    return toolToProviderFormat(tool) as unknown as ToolDefinition;
  }

  getAllDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => toolToProviderFormat(tool) as unknown as ToolDefinition);
  }

  async execute(
    name: string,
    input: unknown
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool ${name} not found` };
    }

    try {
      const result = await tool.execute(
        `tool_${Date.now()}`,
        input as Record<string, unknown>
      );
      
      const textContent = result.content.find(c => c.type === 'text');
      return {
        success: true,
        output: textContent?.type === 'text' ? textContent.text : JSON.stringify(result.content),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
