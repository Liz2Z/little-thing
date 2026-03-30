import { z } from 'zod';
import { existsSync, readdirSync, statSync } from 'fs';
import nodePath from 'path';
import type { ToolDefinition, ToolExecutionResult } from './types.js';
import { resolveToCwd } from './path-utils.js';
import { DEFAULT_MAX_BYTES, formatSize, TruncationResultSchema, truncateHead } from './truncate.js';
import { ValidationError, ForbiddenError } from '../errors/base.js';

class ToolAbortedError extends ValidationError {
  constructor() {
    super(['TOOL:ABORTED', 200, '操作被中断'] as const);
  }
}

class FileNotFoundError extends ValidationError {
  constructor(path: string) {
    super(['TOOL:FILE_NOT_FOUND', 400, '文件不存在'] as const, { path });
  }
}

class NotADirectoryError extends ValidationError {
  constructor(path: string) {
    super(['TOOL:NOT_A_DIRECTORY', 400, '不是目录'] as const, { path });
  }
}

class PermissionDeniedError extends ForbiddenError {
  constructor(path: string, reason: string) {
    super(['TOOL:PERMISSION_DENIED', 403, '权限不足'] as const, { path, reason });
  }
}

const lsSchema = z.object({
  path: z.string().describe('Directory to list (default: current directory)').optional(),
  limit: z.number().describe('Maximum number of entries to return (default: 500)').optional(),
});

export type LsToolInput = z.infer<typeof lsSchema>;

const DEFAULT_LIMIT = 500;

export const LsToolDetailsSchema = z.object({
  truncation: TruncationResultSchema.optional(),
  entryLimitReached: z.number().optional(),
});
export type LsToolDetails = z.infer<typeof LsToolDetailsSchema>;

// DI 契约，保留 TS interface
export interface LsOperations {
  exists: (absolutePath: string) => Promise<boolean> | boolean;
  stat: (absolutePath: string) => Promise<{ isDirectory: () => boolean }> | { isDirectory: () => boolean };
  readdir: (absolutePath: string) => Promise<string[]> | string[];
}

const defaultLsOperations: LsOperations = {
  exists: existsSync,
  stat: statSync,
  readdir: readdirSync,
};

export interface LsToolOptions {
  operations?: LsOperations;
}

export function createLsTool(cwd: string, options?: LsToolOptions): ToolDefinition<typeof lsSchema, LsToolDetails> {
  const ops = options?.operations ?? defaultLsOperations;

  return {
    name: 'ls',
    label: 'ls',
    description: `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LIMIT} entries or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
    parameters: lsSchema,
    execute: async (
      _toolCallId: string,
      { path, limit }: { path?: string; limit?: number },
      signal?: AbortSignal,
    ) => {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new ToolAbortedError());
          return;
        }

        const onAbort = () => reject(new ToolAbortedError());
        signal?.addEventListener('abort', onAbort, { once: true });

        (async () => {
          try {
            const dirPath = resolveToCwd(path || '.', cwd);
            const effectiveLimit = limit ?? DEFAULT_LIMIT;

            if (!(await ops.exists(dirPath))) {
              reject(new FileNotFoundError(dirPath));
              return;
            }

            const stat = await ops.stat(dirPath);
            if (!stat.isDirectory()) {
              reject(new NotADirectoryError(dirPath));
              return;
            }

            let entries: string[];
            try {
              entries = await ops.readdir(dirPath);
            } catch (e: any) {
              reject(new PermissionDeniedError(dirPath, e.message));
              return;
            }

            entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            const results: string[] = [];
            let entryLimitReached = false;

            for (const entry of entries) {
              if (results.length >= effectiveLimit) {
                entryLimitReached = true;
                break;
              }

              const fullPath = nodePath.join(dirPath, entry);
              let suffix = '';

              try {
                const entryStat = await ops.stat(fullPath);
                if (entryStat.isDirectory()) {
                  suffix = '/';
                }
              } catch {
                continue;
              }

              results.push(entry + suffix);
            }

            signal?.removeEventListener('abort', onAbort);

            if (results.length === 0) {
              resolve({ content: [{ type: 'text', text: '(empty directory)' }], details: undefined });
              return;
            }

            const rawOutput = results.join('\n');
            const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });

            let output = truncation.content;
            const details: LsToolDetails = {};

            const notices: string[] = [];

            if (entryLimitReached) {
              notices.push(`${effectiveLimit} entries limit reached. Use limit=${effectiveLimit * 2} for more`);
              details.entryLimitReached = effectiveLimit;
            }

            if (truncation.truncated) {
              notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
              details.truncation = truncation;
            }

            if (notices.length > 0) {
              output += `\n\n[${notices.join('. ')}]`;
            }

            resolve({
              content: [{ type: 'text', text: output }],
              details: Object.keys(details).length > 0 ? details : undefined,
            });
          } catch (e: any) {
            signal?.removeEventListener('abort', onAbort);
            reject(e);
          }
        })();
      });
    },
  };
}

export const lsTool = createLsTool(process.cwd());
