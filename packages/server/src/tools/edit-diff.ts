import { z } from "zod";

const BOM = "\uFEFF";

export function stripBom(content: string): { bom: string; text: string } {
  if (content.startsWith(BOM)) {
    return { bom: BOM, text: content.slice(1) };
  }
  return { bom: "", text: content };
}

export function detectLineEnding(content: string): "\r\n" | "\n" {
  const crlfIndex = content.indexOf("\r\n");
  if (crlfIndex !== -1) {
    return "\r\n";
  }
  return "\n";
}

export function normalizeToLF(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function restoreLineEndings(
  content: string,
  lineEnding: "\r\n" | "\n",
): string {
  if (lineEnding === "\r\n") {
    return content.replace(/\n/g, "\r\n");
  }
  return content;
}

export function normalizeForFuzzyMatch(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

export const FuzzyMatchResultSchema = z.object({
  found: z.boolean(),
  index: z.number(),
  matchLength: z.number(),
  contentForReplacement: z.string(),
});
export type FuzzyMatchResult = z.infer<typeof FuzzyMatchResultSchema>;

export function fuzzyFindText(
  content: string,
  searchText: string,
): FuzzyMatchResult {
  const exactIndex = content.indexOf(searchText);
  if (exactIndex !== -1) {
    return {
      found: true,
      index: exactIndex,
      matchLength: searchText.length,
      contentForReplacement: content,
    };
  }

  const normalizedContent = normalizeForFuzzyMatch(content);
  const normalizedSearch = normalizeForFuzzyMatch(searchText);

  const fuzzyIndex = normalizedContent.indexOf(normalizedSearch);
  if (fuzzyIndex === -1) {
    return {
      found: false,
      index: -1,
      matchLength: 0,
      contentForReplacement: content,
    };
  }

  let _charCount = 0;
  let normalizedCharCount = 0;
  let startIndex = -1;
  let endIndex = -1;

  for (
    let i = 0;
    i < content.length &&
    normalizedCharCount <= fuzzyIndex + normalizedSearch.length;
    i++
  ) {
    const char = content[i];
    const normalizedChar = char === "\r" ? "" : char === "\t" ? " " : char;

    if (normalizedCharCount === fuzzyIndex && startIndex === -1) {
      startIndex = i;
    }

    if (normalizedChar) {
      normalizedCharCount++;
    }
    _charCount++;

    if (
      normalizedCharCount === fuzzyIndex + normalizedSearch.length &&
      endIndex === -1
    ) {
      endIndex = i + 1;
    }
  }

  if (startIndex === -1 || endIndex === -1) {
    return {
      found: false,
      index: -1,
      matchLength: 0,
      contentForReplacement: content,
    };
  }

  return {
    found: true,
    index: startIndex,
    matchLength: endIndex - startIndex,
    contentForReplacement: normalizedContent,
  };
}

export const DiffResultSchema = z.object({
  diff: z.string(),
  firstChangedLine: z.number().optional(),
});
export type DiffResult = z.infer<typeof DiffResultSchema>;

export function generateDiffString(
  oldContent: string,
  newContent: string,
): DiffResult {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const diff: string[] = [];
  let firstChangedLine: number | undefined;

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      if (firstChangedLine === undefined) firstChangedLine = i + 1;
      diff.push(`+ ${newLine}`);
    } else if (newLine === undefined) {
      if (firstChangedLine === undefined) firstChangedLine = i + 1;
      diff.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      if (firstChangedLine === undefined) firstChangedLine = i + 1;
      diff.push(`- ${oldLine}`);
      diff.push(`+ ${newLine}`);
    }
  }

  return {
    diff: diff.join("\n"),
    firstChangedLine,
  };
}
