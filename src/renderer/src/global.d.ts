import type {
  AgentUiEvent,
  AppRuntimeInfo,
  AssistantConfig,
  ClipboardSuggestion,
  EditableAppSettings,
  PetRuntimeConfig,
  TaskHistoryItem,
  WindowRect
} from "../../shared/types";

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
      getSettings: () => Promise<EditableAppSettings>;
      saveSettings: (settings: EditableAppSettings) => Promise<EditableAppSettings>;
      chooseWorkspace: () => Promise<string | null>;
      choosePetFolder: () => Promise<EditableAppSettings["pet"] | null>;
      getPetRuntimeConfig: () => Promise<PetRuntimeConfig>;
      getAssistantConfig: () => Promise<AssistantConfig>;
      acceptClipboardSuggestion: (id: string) => Promise<void>;
      onSettingsUpdated: (callback: (settings: EditableAppSettings) => void) => () => void;
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
