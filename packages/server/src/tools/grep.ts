import { stat, readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import type { ToolResult, GrepParams } from './types.js';

interface Match {
  file: string;
  line: number;
  content: string;
  context?: { before: string[]; after: string[] };
}

async function walkDir(dir: string, glob?: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (glob) {
          const regex = new RegExp('^' + glob.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
          if (regex.test(entry.name)) {
            files.push(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }
  }
  
  await walk(dir);
  return files;
}

async function searchInFile(
  filePath: string,
  pattern: RegExp,
  contextLines: number
): Promise<Match[]> {
  const matches: Match[] = [];
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      const before = lines.slice(Math.max(0, i - contextLines), i);
      const after = lines.slice(i + 1, i + 1 + contextLines);
      
      matches.push({
        file: filePath,
        line: i + 1,
        content: lines[i],
        context: contextLines > 0 ? { before, after } : undefined,
      });
    }
  }
  
  return matches;
}

export async function grep(params: GrepParams): Promise<ToolResult> {
  try {
    const searchPath = params.path || process.cwd();
    const stats = await stat(searchPath);
    
    if (!stats.isDirectory() && !stats.isFile()) {
      return {
        success: false,
        error: `Error: ${searchPath} is not a file or directory`,
      };
    }

    const flags = params['-i'] ? 'i' : '';
    const pattern = new RegExp(params.pattern, flags);
    
    const contextLines = params['-C'] ?? 0;
    
    let files: string[];
    if (stats.isFile()) {
      files = [searchPath];
    } else {
      files = await walkDir(searchPath, params.glob);
    }
    
    const allMatches: Match[] = [];
    
    for (const file of files) {
      try {
        const matches = await searchInFile(file, pattern, contextLines);
        allMatches.push(...matches);
      } catch {
        continue;
      }
    }
    
    const outputMode = params.output_mode ?? 'files_with_matches';
    
    if (outputMode === 'count') {
      return {
        success: true,
        output: String(allMatches.length),
      };
    }
    
    if (outputMode === 'files_with_matches') {
      const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
      return {
        success: true,
        output: uniqueFiles.join('\n'),
      };
    }
    
    const outputLines: string[] = [];
    
    for (const match of allMatches) {
      if (match.context) {
        for (const ctxLine of match.context.before) {
          outputLines.push(`${match.file}-${ctxLine}`);
        }
      }
      
      if (params['-n']) {
        outputLines.push(`${match.file}:${match.line}:${match.content}`);
      } else {
        outputLines.push(`${match.file}:${match.content}`);
      }
      
      if (match.context) {
        for (const ctxLine of match.context.after) {
          outputLines.push(`${match.file}-${ctxLine}`);
        }
      }
    }
    
    return {
      success: true,
      output: outputLines.join('\n'),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: `Error: ${params.path} does not exist`,
      };
    }
    return {
      success: false,
      error: `Error: ${error}`,
    };
  }
}
