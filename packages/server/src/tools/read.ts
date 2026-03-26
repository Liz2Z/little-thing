import { z } from 'zod';
import { constants } from 'fs';
import { access as fsAccess, readFile as fsReadFile } from 'fs/promises';
import type { ToolDefinition, ToolExecutionResult, TextContent, ImageContent } from './types.js';
import { resolveReadPath } from './path-utils.js';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationResult, truncateHead } from './truncate.js';
import { ValidationError, ToolErrors } from '../errors/index.js';

const readSchema = z.object({
  path: z.string().describe('Path to the file to read (relative or absolute)'),
  offset: z.number().describe('Line number to start reading from (1-indexed)').optional(),
  limit: z.number().describe('Maximum number of lines to read').optional(),
});

export type ReadToolInput = z.infer<typeof readSchema>;

export interface ReadToolDetails {
  truncation?: TruncationResult;
}

export interface ReadOperations {
  readFile: (absolutePath: string) => Promise<Buffer>;
  access: (absolutePath: string) => Promise<void>;
  detectImageMimeType?: (absolutePath: string) => Promise<string | null | undefined>;
}

const defaultReadOperations: ReadOperations = {
  readFile: (path) => fsReadFile(path),
  access: (path) => fsAccess(path, constants.R_OK),
  detectImageMimeType: async () => null,
};

export interface ReadToolOptions {
  autoResizeImages?: boolean;
  operations?: ReadOperations;
}

export function createReadTool(cwd: string, options?: ReadToolOptions): ToolDefinition<typeof readSchema, ReadToolDetails> {
  const ops = options?.operations ?? defaultReadOperations;

  return {
    name: 'read',
    label: 'read',
    description: `Read the contents of a file. Supports text files. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
    parameters: readSchema,
    execute: async (
      _toolCallId: string,
      { path, offset, limit }: { path: string; offset?: number; limit?: number },
      signal?: AbortSignal,
    ) => {
      const absolutePath = resolveReadPath(path, cwd);

      return new Promise<{ content: (TextContent | ImageContent)[]; details: ReadToolDetails | undefined }>(
        (resolve, reject) => {
          if (signal?.aborted) {
            reject(new ValidationError(ToolErrors.ABORTED));
            return;
          }

          let aborted = false;

          const onAbort = () => {
            aborted = true;
            reject(new ValidationError(ToolErrors.ABORTED));
          };

          if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
          }

          (async () => {
            try {
              await ops.access(absolutePath);

              if (aborted) {
                return;
              }

              const buffer = await ops.readFile(absolutePath);
              const textContent = buffer.toString('utf-8');
              const allLines = textContent.split('\n');
              const totalFileLines = allLines.length;

              const startLine = offset ? Math.max(0, offset - 1) : 0;
              const startLineDisplay = startLine + 1;

              if (startLine >= allLines.length) {
                throw new ValidationError(ToolErrors.OFFSET_BEYOND_END, {
                  offset,
                  totalLines: allLines.length,
                });
              }

              let selectedContent: string;
              let userLimitedLines: number | undefined;
              if (limit !== undefined) {
                const endLine = Math.min(startLine + limit, allLines.length);
                selectedContent = allLines.slice(startLine, endLine).join('\n');
                userLimitedLines = endLine - startLine;
              } else {
                selectedContent = allLines.slice(startLine).join('\n');
              }

              const truncation = truncateHead(selectedContent);

              let outputText: string;
              let details: ReadToolDetails | undefined;

              if (truncation.firstLineExceedsLimit) {
                const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine], 'utf-8'));
                outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${path} | head -c ${DEFAULT_MAX_BYTES}]`;
                details = { truncation };
              } else if (truncation.truncated) {
                const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
                const nextOffset = endLineDisplay + 1;

                outputText = truncation.content;

                if (truncation.truncatedBy === 'lines') {
                  outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
                } else {
                  outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
                }
                details = { truncation };
              } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
                const remaining = allLines.length - (startLine + userLimitedLines);
                const nextOffset = startLine + userLimitedLines + 1;

                outputText = truncation.content;
                outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
              } else {
                outputText = truncation.content;
              }

              if (aborted) {
                return;
              }

              if (signal) {
                signal.removeEventListener('abort', onAbort);
              }

              resolve({ content: [{ type: 'text', text: outputText }], details });
            } catch (error: any) {
              if (signal) {
                signal.removeEventListener('abort', onAbort);
              }

              if (!aborted) {
                reject(error);
              }
            }
          })();
        },
      );
    },
  };
}

export const readTool = createReadTool(process.cwd());
