import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { settings } from "../settings/index.js";

export interface PromptLayerInput {
  cwd: string;
  provider: string;
  model: string;
  sessionSystemPrompt?: string;
  runtimeSystemPrompt?: string;
}

export interface PromptLayerResult {
  systemPrompt: string;
  layers: {
    agents: string | null;
    provider: string | null;
    model: string | null;
    session: string | null;
    runtime: string | null;
  };
}

const AGENTS_FILENAME = "AGENTS.md";

type AgentsCache = {
  path: string;
  mtimeMs: number;
  content: string;
};

let agentsCache: AgentsCache | null = null;

function readAgentsPrompt(cwd: string): string | null {
  const path = join(cwd, AGENTS_FILENAME);
  if (!existsSync(path)) {
    return null;
  }

  const stat = statSync(path);
  if (
    agentsCache &&
    agentsCache.path === path &&
    agentsCache.mtimeMs === stat.mtimeMs
  ) {
    return agentsCache.content;
  }

  const content = readFileSync(path, "utf-8").trim();
  agentsCache = {
    path,
    mtimeMs: stat.mtimeMs,
    content,
  };
  return content || null;
}

function compactPrompts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export function buildSystemPrompt(input: PromptLayerInput): PromptLayerResult {
  const promptSettings = settings.prompts.get();
  const agentsPrompt = readAgentsPrompt(input.cwd);
  const providerPrompt = promptSettings.providers[input.provider] ?? null;
  const modelPrompt = promptSettings.models[input.model] ?? null;
  const sessionPrompt = input.sessionSystemPrompt ?? null;
  const runtimePrompt = input.runtimeSystemPrompt ?? null;

  const systemPrompt = compactPrompts([
    agentsPrompt,
    promptSettings.globalSystemPrompt,
    providerPrompt,
    modelPrompt,
    sessionPrompt,
    runtimePrompt,
  ]);

  return {
    systemPrompt,
    layers: {
      agents: agentsPrompt,
      provider: providerPrompt,
      model: modelPrompt,
      session: sessionPrompt,
      runtime: runtimePrompt,
    },
  };
}
