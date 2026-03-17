export {
  createLsTool,
  lsTool,
  type LsOperations,
  type LsToolDetails,
  type LsToolInput,
  type LsToolOptions,
} from './ls.js';

export {
  createReadTool,
  readTool,
  type ReadOperations,
  type ReadToolDetails,
  type ReadToolInput,
  type ReadToolOptions,
} from './read.js';

export {
  createWriteTool,
  writeTool,
  type WriteOperations,
  type WriteToolInput,
  type WriteToolOptions,
} from './write.js';

export {
  createEditTool,
  editTool,
  type EditOperations,
  type EditToolDetails,
  type EditToolInput,
  type EditToolOptions,
} from './edit.js';

export {
  createGrepTool,
  grepTool,
  type GrepOperations,
  type GrepToolDetails,
  type GrepToolInput,
  type GrepToolOptions,
} from './grep.js';

export {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  type TruncationOptions,
  type TruncationResult,
  truncateHead,
  truncateTail,
  truncateLine,
  GREP_MAX_LINE_LENGTH,
} from './truncate.js';

export {
  expandPath,
  resolveToCwd,
  resolveReadPath,
} from './path-utils.js';

export {
  stripBom,
  detectLineEnding,
  normalizeToLF,
  restoreLineEndings,
  normalizeForFuzzyMatch,
  fuzzyFindText,
  generateDiffString,
  type FuzzyMatchResult,
  type DiffResult,
} from './edit-diff.js';

export type {
  AnyTool,
  ToolDefinition,
  ToolExecutionResult,
  ToolName,
  TextContent,
  ImageContent,
} from './types.js';

export { isTextContent, getTextContent } from './types.js';

import type { AnyTool } from './types.js';
import { createLsTool, lsTool } from './ls.js';
import { createReadTool, readTool } from './read.js';
import { createWriteTool, writeTool } from './write.js';
import { createEditTool, editTool } from './edit.js';
import { createGrepTool, grepTool } from './grep.js';

export const codingTools: AnyTool[] = [readTool, editTool, writeTool] as AnyTool[];

export const readOnlyTools: AnyTool[] = [readTool, grepTool, lsTool] as AnyTool[];

export const allTools: Record<string, AnyTool> = {
  read: readTool as AnyTool,
  write: writeTool as AnyTool,
  edit: editTool as AnyTool,
  grep: grepTool as AnyTool,
  ls: lsTool as AnyTool,
};

export type AllToolsName = keyof typeof allTools;

export function createCodingTools(cwd: string): AnyTool[] {
  return [
    createReadTool(cwd),
    createEditTool(cwd),
    createWriteTool(cwd),
  ] as AnyTool[];
}

export function createReadOnlyTools(cwd: string): AnyTool[] {
  return [
    createReadTool(cwd),
    createGrepTool(cwd),
    createLsTool(cwd),
  ] as AnyTool[];
}

export function createAllTools(cwd: string): Record<AllToolsName, AnyTool> {
  return {
    read: createReadTool(cwd) as AnyTool,
    write: createWriteTool(cwd) as AnyTool,
    edit: createEditTool(cwd) as AnyTool,
    grep: createGrepTool(cwd) as AnyTool,
    ls: createLsTool(cwd) as AnyTool,
  };
}
