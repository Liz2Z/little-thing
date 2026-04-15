import type { z } from "zod";
import {
  type KnownProviderSummary,
  listKnownProviders,
  listModels,
} from "../providers/index.js";
import { createSessionService, type SessionService } from "../session/index.js";
import {
  getSettingsPaths,
  type SettingsPaths,
  settings,
  type settingsSchema,
} from "../settings/index.js";
import { createAllTools } from "../tools/index.js";
import type { AnyTool } from "../tools/types.js";
import { type CliIO, createNodeIO } from "./io.js";

export interface ProviderModelSummary {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export type ThingSettings = z.infer<typeof settingsSchema>;

export interface CliSessionService
  extends Pick<
    SessionService,
    | "abort"
    | "createSession"
    | "deleteSession"
    | "forkSession"
    | "getSession"
    | "listSessions"
    | "renameSession"
    | "resumeSession"
    | "startRun"
    | "subscribeRunEvents"
  > {}

export interface CliContext {
  cwd: string;
  io: CliIO;
  sessionService: CliSessionService;
  settingsSnapshot: ThingSettings;
  settingsPaths: SettingsPaths;
  knownProviders: KnownProviderSummary[];
  tools: AnyTool[];
  loadProviderModels(providerId: string): Promise<ProviderModelSummary[]>;
}

export interface CliContextOptions {
  cwd?: string;
  io?: CliIO;
  sessionService?: CliSessionService;
  settingsSnapshot?: ThingSettings;
  settingsPaths?: SettingsPaths;
  knownProviders?: KnownProviderSummary[];
  tools?: AnyTool[];
  loadProviderModels?: (providerId: string) => Promise<ProviderModelSummary[]>;
}

export function createCliContext(options: CliContextOptions = {}): CliContext {
  const cwd = options.cwd ?? process.cwd();

  return {
    cwd,
    io: options.io ?? createNodeIO(),
    sessionService: options.sessionService ?? createSessionService(cwd),
    settingsSnapshot: options.settingsSnapshot ?? settings.get(),
    settingsPaths: options.settingsPaths ?? getSettingsPaths(),
    knownProviders: options.knownProviders ?? listKnownProviders(),
    tools: options.tools ?? Object.values(createAllTools(cwd)),
    loadProviderModels: options.loadProviderModels ?? listModels,
  };
}
