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
