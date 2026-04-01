export {
  createEditTool,
  type EditOperations,
  type EditToolDetails,
  type EditToolInput,
  type EditToolOptions,
  editTool,
} from "./edit.js";
export {
  type DiffResult,
  DiffResultSchema,
  detectLineEnding,
  type FuzzyMatchResult,
  FuzzyMatchResultSchema,
  fuzzyFindText,
  generateDiffString,
  normalizeForFuzzyMatch,
  normalizeToLF,
  restoreLineEndings,
  stripBom,
} from "./edit-diff.js";
export {
  createGrepTool,
  type GrepOperations,
  type GrepToolDetails,
  type GrepToolInput,
  type GrepToolOptions,
  grepTool,
} from "./grep.js";
export {
  createLsTool,
  type LsOperations,
  type LsToolDetails,
  type LsToolInput,
  type LsToolOptions,
  lsTool,
} from "./ls.js";
export {
  expandPath,
  resolveReadPath,
  resolveToCwd,
} from "./path-utils.js";
export {
  createReadTool,
  type ReadOperations,
  type ReadToolDetails,
  type ReadToolInput,
  type ReadToolOptions,
  readTool,
} from "./read.js";
export { ToolRegistry } from "./registry.js";
export {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  GREP_MAX_LINE_LENGTH,
  type TruncationOptions,
  TruncationOptionsSchema,
  type TruncationResult,
  TruncationResultSchema,
  truncateHead,
  truncateLine,
  truncateTail,
} from "./truncate.js";

export type {
  AnyTool,
  ImageContent,
  TextContent,
  ToolContent,
  ToolDefinition,
  ToolExecutionResult,
  ToolName,
} from "./types.js";

export {
  getTextContent,
  ImageContentSchema,
  isTextContent,
  TextContentSchema,
  ToolContentSchema,
} from "./types.js";
export {
  createWriteTool,
  type WriteOperations,
  type WriteToolInput,
  type WriteToolOptions,
  writeTool,
} from "./write.js";

import { createEditTool, editTool } from "./edit.js";
import { createGrepTool, grepTool } from "./grep.js";
import { createLsTool, lsTool } from "./ls.js";
import { createReadTool, readTool } from "./read.js";
import type { AnyTool } from "./types.js";
import { createWriteTool, writeTool } from "./write.js";

export const codingTools: AnyTool[] = [
  readTool,
  editTool,
  writeTool,
] as AnyTool[];

export const readOnlyTools: AnyTool[] = [
  readTool,
  grepTool,
  lsTool,
] as AnyTool[];

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
