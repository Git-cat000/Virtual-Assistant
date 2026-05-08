import { app, dialog, type BrowserWindow } from "electron";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRuntimeConfig } from "./agentConfig";
import type { FeatureConfig } from "./featureConfig";
import type { AgentUiState, EditableAppSettings, PetAnimationName, PetAsset, PetRuntimeConfig } from "../shared/types";

type PetManifestFile = EditableAppSettings["pet"];

type CodexPetDefinition = {
  spritesheetPath?: string;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  fps?: number;
  displayScale?: number;
  frameMs?: Partial<Record<PetAnimationName, number>>;
  animations?: Partial<Record<PetAnimationName, number[]>>;
};

const stateOrder: AgentUiState[] = ["idle", "thinking", "working", "alert", "error"];
// Codex pet spritesheets use 256px source frames, but the desktop pet is shown smaller.
// Change this value if you want a different global default display size.
const defaultCodexFrameWidth = 256;
const defaultCodexDisplayScale = 0.38;

const defaultAgentConfig: AgentRuntimeConfig = {
  provider: "mock",
  workspace: ".",
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

  getPublicDir() {
    return this.publicDir;
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
    const configuredWorkspace = process.env.VIRTUAL_ASSISTANT_WORKSPACE?.trim() || fileConfig.workspace || getDefaultWorkspace();
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
      nextAssets[item] = normalizePetAsset(value, this.petDir, this.publicDir);
    }
    return nextAssets;
  }

  private createCodexPetAssets(petJsonPath: string): Partial<Record<AgentUiState, PetAsset>> {
    const absolutePetJsonPath = resolve(this.petDir, petJsonPath);
    const definition = readJson<CodexPetDefinition>(absolutePetJsonPath, {});
    if (!definition.spritesheetPath) return {};

    const spritesheetPath = resolve(dirname(absolutePetJsonPath), definition.spritesheetPath);
    const geometry = resolveCodexSpritesheetGeometry(spritesheetPath, definition);
    const asset: PetAsset = {
      src: this.toPublicAssetUrl(spritesheetPath),
      kind: "spritesheet",
      frameWidth: geometry.frameWidth,
      frameHeight: geometry.frameHeight,
      columns: geometry.columns,
      rows: geometry.rows,
      fps: definition.fps ?? 6,
      displayScale: definition.displayScale ?? defaultCodexDisplayScale,
      frameMs: definition.frameMs ?? createDefaultCodexFrameDurations(),
      animations: definition.animations ?? createDefaultCodexAnimations()
    };
    return Object.fromEntries(stateOrder.map((item) => [item, asset]));
  }

  private toPublicAssetUrl(absolutePath: string) {
    return toPublicAssetUrl(absolutePath, this.publicDir);
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
    workspace: resolve(config.workspace || getDefaultWorkspace()),
    claudeCode: {
      permissionMode: (config.claudeCode.permissionMode || "default") as PermissionMode,
      allowedTools: normalizeStringList(config.claudeCode.allowedTools, defaultAgentConfig.claudeCode.allowedTools),
      disallowedTools: normalizeStringList(config.claudeCode.disallowedTools, defaultAgentConfig.claudeCode.disallowedTools),
      permissionTimeoutMs: Math.max(1000, Number(config.claudeCode.permissionTimeoutMs || 60000))
    }
  };
}

function getDefaultWorkspace() {
  return app.isPackaged ? app.getPath("home") : process.cwd();
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

function normalizePetAsset(value: string | PetAsset, baseDir: string, publicDir: string): PetAsset {
  const asset = typeof value === "string" ? { src: value } : value;
  const src = /^(https?:|file:|data:|\/|va-asset:)/i.test(asset.src) ? asset.src : toPublicAssetUrl(join(baseDir, asset.src), publicDir);
  return {
    ...asset,
    src,
    kind: asset.kind ?? inferKind(asset.src)
  };
}

function toPublicAssetUrl(absolutePath: string, publicDir?: string) {
  const root = publicDir ?? join(process.cwd(), "src", "renderer", "public");
  const resolved = resolve(absolutePath);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) return `va-asset://file/${encodePath(resolved)}`;
  return `va-asset://public/${encodePath(rel)}`;
}

function encodePath(path: string) {
  return path.split(sep).map(encodeURIComponent).join("/");
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

function createDefaultCodexAnimations(): Partial<Record<PetAnimationName, number[]>> {
  return {
    idle: [0, 1, 2, 3, 4, 5],
    hover: [21, 22, 23, 24],
    thinking: [35, 36, 37, 38, 39, 40, 41],
    working: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    alert: [21, 22, 23, 24],
    error: [35, 36, 37, 38, 39, 40, 41]
  };
}

function createDefaultCodexFrameDurations(): Partial<Record<PetAnimationName, number>> {
  return {
    idle: 2000,
    hover: 260,
    thinking: 700,
    working: 160,
    alert: 260,
    error: 900
  };
}

function resolveCodexSpritesheetGeometry(spritesheetPath: string, definition: CodexPetDefinition) {
  const imageSize = readWebpSize(spritesheetPath);
  const maxFrame = getMaxAnimationFrame(definition.animations ?? createDefaultCodexAnimations());

  if (definition.frameWidth && definition.frameHeight) {
    return {
      frameWidth: definition.frameWidth,
      frameHeight: definition.frameHeight,
      columns: definition.columns ?? Math.max(1, Math.floor((imageSize?.width ?? definition.frameWidth) / definition.frameWidth)),
      rows: definition.rows ?? Math.max(1, Math.floor((imageSize?.height ?? definition.frameHeight) / definition.frameHeight))
    };
  }

  if (imageSize && definition.columns && definition.rows) {
    return {
      frameWidth: Math.floor(imageSize.width / definition.columns),
      frameHeight: Math.floor(imageSize.height / definition.rows),
      columns: definition.columns,
      rows: definition.rows
    };
  }

  if (imageSize) {
    const columns =
      definition.columns ??
      (imageSize.width % defaultCodexFrameWidth === 0 ? Math.max(1, imageSize.width / defaultCodexFrameWidth) : 1);
    const minRows = Math.max(1, Math.floor(maxFrame / columns) + 1);
    const rows = definition.rows ?? chooseLikelySpriteRows(imageSize.height, minRows);
    return {
      frameWidth: definition.frameWidth ?? Math.floor(imageSize.width / columns),
      frameHeight: definition.frameHeight ?? Math.floor(imageSize.height / rows),
      columns,
      rows
    };
  }

  return {
    frameWidth: definition.frameWidth ?? defaultCodexFrameWidth,
    frameHeight: definition.frameHeight ?? defaultCodexFrameWidth,
    columns: definition.columns ?? 1,
    rows: definition.rows ?? Math.max(1, Math.floor(maxFrame / (definition.columns ?? 1)) + 1)
  };
}

function getMaxAnimationFrame(animations: Partial<Record<PetAnimationName, number[]>>) {
  return Math.max(0, ...Object.values(animations).flatMap((frames) => frames ?? []));
}

function chooseLikelySpriteRows(totalHeight: number, minRows: number) {
  let bestRows = Math.max(1, minRows);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let rows = minRows; rows <= 24; rows += 1) {
    if (totalHeight % rows !== 0) continue;
    const frameHeight = totalHeight / rows;
    const score = Math.abs(frameHeight - defaultCodexFrameWidth);
    if (score < bestScore) {
      bestRows = rows;
      bestScore = score;
    }
  }

  return bestRows;
}

function readWebpSize(path: string) {
  if (!existsSync(path)) return null;

  try {
    const buffer = readFileSync(path);
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunkType = buffer.toString("ascii", 12, 16);

    if (chunkType === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3)
      };
    }

    if (chunkType === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1
      };
    }

    if (chunkType === "VP8 ") {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff
      };
    }
  } catch {
    return null;
  }

  return null;
}
