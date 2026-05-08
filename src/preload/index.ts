import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentUiEvent,
  AppRuntimeInfo,
  AssistantConfig,
  ClipboardSuggestion,
  EditableAppSettings,
  PetRuntimeConfig,
  TaskHistoryItem,
  WindowRect
} from "../shared/types";

contextBridge.exposeInMainWorld("virtualAssistant", {
  runAgent: (prompt: string) => ipcRenderer.invoke("agent:run", prompt),
  respondPermission: (id: string, allowed: boolean) => {
    ipcRenderer.send("agent:permission-response", { id, allowed });
  },
  moveBy: (dx: number, dy: number) => {
    ipcRenderer.send("window:move-by", { dx, dy });
  },
  setMouseInteractive: (interactive: boolean) => {
    ipcRenderer.send("window:set-mouse-interactive", interactive);
  },
  isCursorInWindowRect: (rect: WindowRect) => ipcRenderer.invoke("window:is-cursor-in-rect", rect),
  getTaskHistory: () => ipcRenderer.invoke("task-history:get") as Promise<TaskHistoryItem[]>,
  getRuntimeInfo: () => ipcRenderer.invoke("runtime:get-info") as Promise<AppRuntimeInfo>,
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<EditableAppSettings>,
  saveSettings: (settings: EditableAppSettings) => ipcRenderer.invoke("settings:save", settings) as Promise<EditableAppSettings>,
  chooseWorkspace: () => ipcRenderer.invoke("settings:choose-workspace") as Promise<string | null>,
  choosePetFolder: () => ipcRenderer.invoke("settings:choose-pet-folder") as Promise<EditableAppSettings["pet"] | null>,
  getPetRuntimeConfig: () => ipcRenderer.invoke("settings:get-pet-runtime") as Promise<PetRuntimeConfig>,
  getAssistantConfig: () => ipcRenderer.invoke("settings:get-assistant") as Promise<AssistantConfig>,
  acceptClipboardSuggestion: (id: string) => ipcRenderer.invoke("clipboard:accept-suggestion", id),
  onSettingsUpdated: (callback: (settings: EditableAppSettings) => void) => {
    const listener = (_: unknown, settings: EditableAppSettings) => callback(settings);
    ipcRenderer.on("settings:updated", listener);
    return () => ipcRenderer.removeListener("settings:updated", listener);
  },
  onTaskHistoryUpdated: (callback: (items: TaskHistoryItem[]) => void) => {
    const listener = (_: unknown, items: TaskHistoryItem[]) => callback(items);
    ipcRenderer.on("task-history:updated", listener);
    return () => ipcRenderer.removeListener("task-history:updated", listener);
  },
  onClipboardSuggestion: (callback: (suggestion: ClipboardSuggestion) => void) => {
    const listener = (_: unknown, suggestion: ClipboardSuggestion) => callback(suggestion);
    ipcRenderer.on("clipboard:suggestion", listener);
    return () => ipcRenderer.removeListener("clipboard:suggestion", listener);
  },
  onAgentEvent: (callback: (event: AgentUiEvent) => void) => {
    const listener = (_: unknown, event: AgentUiEvent) => callback(event);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
  onToggleInput: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("ui:toggle-input", listener);
    return () => ipcRenderer.removeListener("ui:toggle-input", listener);
  },
  onToggleSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("ui:toggle-settings", listener);
    return () => ipcRenderer.removeListener("ui:toggle-settings", listener);
  },
  onToggleHistory: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("ui:toggle-history", listener);
    return () => ipcRenderer.removeListener("ui:toggle-history", listener);
  }
});
