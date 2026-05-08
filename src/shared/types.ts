export type AgentUiState = "idle" | "thinking" | "working" | "alert" | "error";

export type AgentUiEvent =
  | { type: "state"; state: AgentUiState; message?: string }
  | { type: "tool"; toolName: string; summary?: string }
  | { type: "permission"; id: string; toolName: string; input: unknown; message: string }
  | { type: "result"; message: string; sessionId?: string; costUsd?: number }
  | { type: "error"; message: string };

export type TaskHistoryItem = {
  id: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "error";
  startedAt: string;
  endedAt?: string;
  summary?: string;
};

export type AppRuntimeInfo = {
  provider: AgentProvider;
  workspace: string;
  permissionMode: string;
  allowedTools: string[];
  disallowedTools: string[];
};

export type PetAssetKind = "image" | "video" | "lottie" | "spritesheet";

export type PetAsset = {
  src: string;
  kind?: PetAssetKind;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  fps?: number;
  animations?: Partial<Record<AgentUiState, number[]>>;
};

export type AssistantConfig = {
  assistantName: string;
  greeting: string;
  showGreeting: boolean;
};

export type EditableAppSettings = {
  agent: {
    provider: AgentProvider;
    workspace: string;
    claudeCode: {
      permissionMode: string;
      allowedTools: string[];
      disallowedTools: string[];
      permissionTimeoutMs: number;
    };
  };
  assistant: AssistantConfig;
  features: {
    clipboard: {
      enabled: boolean;
      pollMs: number;
      maxPreviewLength: number;
    };
  };
  pet: {
    name: string;
    codexPet?: string;
    states?: Partial<Record<AgentUiState, string | PetAsset>>;
  };
};

export type PetRuntimeConfig = {
  name: string;
  assets: Partial<Record<AgentUiState, PetAsset>>;
};

export type PermissionResponse = {
  id: string;
  allowed: boolean;
};

export type AgentProvider = "mock" | "claude-code";

export type WindowRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ClipboardSuggestion = {
  id: string;
  kind: "code" | "link" | "text";
  preview: string;
};
