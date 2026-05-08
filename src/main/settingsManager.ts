import { app, dialog, type BrowserWindow } from "electron";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRuntimeConfig } from "./agentConfig";
import type { FeatureConfig } from "./featureConfig";
import type { AgentUiState, EditableAppSettings, PetAsset, PetRuntimeConfig } from "../shared/types";

type PetManifestFile = EditableAppSettings["pet"];

type CodexPetDefinition = {
  spritesheetPath?: string;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  fps?: number;
  animations?: Partial<Record<AgentUiState, number[]>>;
};

const stateOrder: AgentUiState[] = ["idle", "thinking", "working", "alert", "error"];

const defaultAgentConfig: AgentRuntimeConfig = {
  provider: "mock",
  workspace: process.cwd(),
  claudeCode: {
    permissionMode: "default",
    allowedTools: ["Read", "Glob", "Grep", "LS"],
    disallowedTools: ["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"],
    permissionTimeoutMs: 60000
  }
};

const defaultFeatureConfig: FeatureConfig = {
  clipboard: {
    enabled: false,
    pollMs: 1200,
    maxPreviewLength: 160
  }
};

const defaultAssistantConfig = {
  assistantName: "Virtual Assistant",
  greeting: "你好，我是你的私人助手 Virtual Assistant",
  showGreeting: true
};

const defaultPetManifest: PetManifestFile = {
  name: "Default CSS fallback",
  states: {}
};

export class SettingsManager {
  private readonly configDir: string;
  private readonly publicDir: string;
  private readonly petDir: string;

  constructor() {
    this.configDir = app.isPackaged ? join(app.getPath("userData"), "config") : join(process.cwd(), "config");
    this.publicDir = app.isPackaged ? join(app.getPath("userData"), "public") : join(process.cwd(), "src", "renderer", "public");
    this.petDir = join(this.publicDir, "pets", "current");
    mkdirSync(this.configDir, { recursive: true });
    mkdirSync(this.petDir, { recursive: true });
    this.seedPackagedDefaults();
  }

  getSettings(): EditableAppSettings {
    return {
      agent: this.loadAgentConfig(),
      assistant: this.loadAssistantConfig(),
      features: this.loadFeatureConfig(),
      pet: this.loadPetManifest()
    };
  }

  saveSettings(settings: EditableAppSettings) {
    const agent = normalizeAgentConfig(settings.agent);
    const features = normalizeFeatureConfig(settings.features);
    const assistant = normalizeAssistantConfig(settings.assistant);
    const pet = normalizePetManifest(settings.pet);

    writeJson(this.agentConfigPath, agent);
    writeJson(this.featureConfigPath, features);
    writeJson(this.assistantConfigPath, assistant);
    writeJson(this.petManifestPath, pet);

    return this.getSettings();
  }

  loadAgentConfig(): AgentRuntimeConfig {
    const fileConfig = readJson<Partial<EditableAppSettings["agent"]>>(this.agentConfigPath, {});
    const provider = normalizeProvider(process.env.VIRTUAL_ASSISTANT_AGENT) ?? fileConfig.provider ?? defaultAgentConfig.provider;
    const configuredWorkspace = process.env.VIRTUAL_ASSISTANT_WORKSPACE?.trim() || fileConfig.workspace || defaultAgentConfig.workspace;
    const workspace = resolve(configuredWorkspace);

    return {
      provider,
      workspace,
      claudeCode: {
        permissionMode: (fileConfig.claudeCode?.permissionMode ?? defaultAgentConfig.claudeCode.permissionMode) as PermissionMode,
        allowedTools: fileConfig.claudeCode?.allowedTools ?? defaultAgentConfig.claudeCode.allowedTools,
        disallowedTools: fileConfig.claudeCode?.disallowedTools ?? defaultAgentConfig.claudeCode.disallowedTools,
        permissionTimeoutMs: fileConfig.claudeCode?.permissionTimeoutMs ?? defaultAgentConfig.claudeCode.permissionTimeoutMs
      }
    };
  }

  loadFeatureConfig(): FeatureConfig {
    return normalizeFeatureConfig(readJson<Partial<FeatureConfig>>(this.featureConfigPath, defaultFeatureConfig));
  }

  loadAssistantConfig() {
    return normalizeAssistantConfig(readJson<Partial<typeof defaultAssistantConfig>>(this.assistantConfigPath, defaultAssistantConfig));
  }

  loadPetRuntimeConfig(): PetRuntimeConfig {
    const manifest = this.loadPetManifest();
    const assets = manifest.codexPet ? this.createCodexPetAssets(manifest.codexPet) : this.createManifestAssets(manifest);
    return {
      name: manifest.name || "Virtual Assistant",
      assets
    };
  }

  async chooseWorkspace(win: BrowserWindow) {
    const result = await dialog.showOpenDialog(win, {
      title: "选择 Agent 工作区",
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  }

  async choosePetFolder(win: BrowserWindow) {
    const result = await dialog.showOpenDialog(win, {
      title: "选择 Codex 桌宠文件夹",
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const source = result.filePaths[0];
    const petJson = join(source, "pet.json");
    const petDefinition = readJson<CodexPetDefinition>(petJson, {});
    if (!existsSync(petJson) || !petDefinition.spritesheetPath) {
      throw new Error("请选择包含 pet.json 和 spritesheetPath 的 Codex 桌宠文件夹");
    }

    const folderName = basename(source);
    const target = join(this.petDir, folderName);
    cpSync(source, target, { recursive: true, force: true });

    const settings = this.getSettings();
    settings.pet = {
      name: folderName,
      codexPet: `${folderName}/pet.json`
    };
    this.saveSettings(settings);
    return settings.pet;
  }

  private loadPetManifest(): PetManifestFile {
    return normalizePetManifest(readJson<Partial<PetManifestFile>>(this.petManifestPath, defaultPetManifest));
  }

  private seedPackagedDefaults() {
    if (!app.isPackaged) return;

    const bundledPublicDir = join(process.resourcesPath, "app.asar", "out", "renderer");
    const bundledPetDir = join(bundledPublicDir, "pets", "current");
    const bundledAssistantConfig = join(bundledPublicDir, "assistant.config.json");

    if (!existsSync(this.petManifestPath) && existsSync(bundledPetDir)) {
      cpSync(bundledPetDir, this.petDir, { recursive: true, force: true });
    }

    if (!existsSync(this.assistantConfigPath) && existsSync(bundledAssistantConfig)) {
      mkdirSync(dirname(this.assistantConfigPath), { recursive: true });
      cpSync(bundledAssistantConfig, this.assistantConfigPath, { force: true });
    }
  }

  private createManifestAssets(manifest: PetManifestFile): Partial<Record<AgentUiState, PetAsset>> {
    const nextAssets: Partial<Record<AgentUiState, PetAsset>> = {};
    for (const item of stateOrder) {
      const value = manifest.states?.[item];
      if (!value) continue;
      nextAssets[item] = normalizePetAsset(value, this.petDir);
    }
    return nextAssets;
  }

  private createCodexPetAssets(petJsonPath: string): Partial<Record<AgentUiState, PetAsset>> {
    const absolutePetJsonPath = resolve(this.petDir, petJsonPath);
    const definition = readJson<CodexPetDefinition>(absolutePetJsonPath, {});
    if (!definition.spritesheetPath) return {};

    const spritesheetPath = resolve(dirname(absolutePetJsonPath), definition.spritesheetPath);
    const asset: PetAsset = {
      src: pathToFileURL(spritesheetPath).toString(),
      kind: "spritesheet",
      frameWidth: definition.frameWidth ?? 256,
      frameHeight: definition.frameHeight ?? 256,
      columns: definition.columns ?? 7,
      rows: definition.rows ?? 8,
      fps: definition.fps ?? 6,
      animations: definition.animations ?? createDefaultCodexAnimations()
    };
    return Object.fromEntries(stateOrder.map((item) => [item, asset]));
  }

  private get agentConfigPath() {
    return join(this.configDir, "agent.config.json");
  }

  private get featureConfigPath() {
    return join(this.configDir, "features.config.json");
  }

  private get assistantConfigPath() {
    return join(this.publicDir, "assistant.config.json");
  }

  private get petManifestPath() {
    return join(this.petDir, "manifest.json");
  }
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeAgentConfig(config: EditableAppSettings["agent"]): AgentRuntimeConfig {
  return {
    provider: normalizeProvider(config.provider) ?? "mock",
    workspace: resolve(config.workspace || process.cwd()),
    claudeCode: {
      permissionMode: (config.claudeCode.permissionMode || "default") as PermissionMode,
      allowedTools: normalizeStringList(config.claudeCode.allowedTools, defaultAgentConfig.claudeCode.allowedTools),
      disallowedTools: normalizeStringList(config.claudeCode.disallowedTools, defaultAgentConfig.claudeCode.disallowedTools),
      permissionTimeoutMs: Math.max(1000, Number(config.claudeCode.permissionTimeoutMs || 60000))
    }
  };
}

function normalizeFeatureConfig(config: Partial<FeatureConfig>): FeatureConfig {
  return {
    clipboard: {
      enabled: Boolean(config.clipboard?.enabled),
      pollMs: Math.max(500, Number(config.clipboard?.pollMs ?? defaultFeatureConfig.clipboard.pollMs)),
      maxPreviewLength: Math.max(40, Number(config.clipboard?.maxPreviewLength ?? defaultFeatureConfig.clipboard.maxPreviewLength))
    }
  };
}

function normalizeAssistantConfig(config: Partial<typeof defaultAssistantConfig>) {
  const assistantName = config.assistantName?.trim() || defaultAssistantConfig.assistantName;
  return {
    assistantName,
    greeting: config.greeting?.trim() || `你好，我是你的私人助手 ${assistantName}`,
    showGreeting: config.showGreeting ?? defaultAssistantConfig.showGreeting
  };
}

function normalizePetManifest(config: Partial<PetManifestFile>): PetManifestFile {
  return {
    name: config.name?.trim() || defaultPetManifest.name,
    codexPet: config.codexPet?.trim() || undefined,
    states: config.states ?? {}
  };
}

function normalizePetAsset(value: string | PetAsset, baseDir: string): PetAsset {
  const asset = typeof value === "string" ? { src: value } : value;
  const src = /^(https?:|file:|data:|\/)/i.test(asset.src) ? asset.src : pathToFileURL(join(baseDir, asset.src)).toString();
  return {
    ...asset,
    src,
    kind: asset.kind ?? inferKind(asset.src)
  };
}

function normalizeStringList(value: string[] | undefined, fallback: string[]) {
  const items = value?.map((item) => item.trim()).filter(Boolean) ?? [];
  return items.length > 0 ? items : fallback;
}

function normalizeProvider(provider?: string) {
  const value = provider?.trim().toLowerCase();
  if (value === "mock") return "mock";
  if (value === "claude-code" || value === "claude") return "claude-code";
  return undefined;
}

function inferKind(src: string) {
  if (/\.(webm|mp4|mov)$/i.test(src)) return "video";
  if (/\.json$/i.test(src)) return "lottie";
  return "image";
}

function createDefaultCodexAnimations(): Partial<Record<AgentUiState, number[]>> {
  return {
    idle: [0, 1, 2, 3, 4, 5],
    thinking: [35, 36, 37, 38, 39, 40, 41],
    working: [7, 8, 9, 10, 11, 12, 13],
    alert: [21, 22, 23, 24],
    error: [28, 29, 30, 31, 32, 33, 34]
  };
}
