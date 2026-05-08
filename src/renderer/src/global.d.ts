import type { AgentUiEvent, AppRuntimeInfo, ClipboardSuggestion, TaskHistoryItem, WindowRect } from "../../shared/types";

declare global {
  interface Window {
    virtualAssistant: {
      runAgent: (prompt: string) => Promise<{ queued: boolean }>;
      respondPermission: (id: string, allowed: boolean) => void;
      moveBy: (dx: number, dy: number) => void;
      setMouseInteractive: (interactive: boolean) => void;
      isCursorInWindowRect: (rect: WindowRect) => Promise<boolean>;
      getTaskHistory: () => Promise<TaskHistoryItem[]>;
      getRuntimeInfo: () => Promise<AppRuntimeInfo>;
      acceptClipboardSuggestion: (id: string) => Promise<void>;
      onTaskHistoryUpdated: (callback: (items: TaskHistoryItem[]) => void) => () => void;
      onClipboardSuggestion: (callback: (suggestion: ClipboardSuggestion) => void) => () => void;
      onAgentEvent: (callback: (event: AgentUiEvent) => void) => () => void;
      onToggleInput: (callback: () => void) => () => void;
      onToggleSettings: (callback: () => void) => () => void;
      onToggleHistory: (callback: () => void) => () => void;
    };
  }
}

export {};
