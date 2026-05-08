import { create } from "zustand";
import type { AgentUiEvent, AgentUiState, ClipboardSuggestion } from "../../../shared/types";

type Bubble =
  | { type: "hidden" }
  | { type: "text"; message: string }
  | { type: "clipboard"; suggestion: ClipboardSuggestion }
  | { type: "permission"; id: string; toolName: string; message: string };

type PetStore = {
  state: AgentUiState;
  bubble: Bubble;
  lastTool: string | null;
  queueCount: number;
  applyAgentEvent: (event: AgentUiEvent) => void;
  markQueued: () => void;
  resolvePermission: (id: string, allowed: boolean) => void;
  hideTextBubble: () => void;
  showTextBubble: (message: string) => void;
  showClipboardSuggestion: (suggestion: ClipboardSuggestion) => void;
  dismissBubble: () => void;
};

export const usePetStore = create<PetStore>((set) => ({
  state: "idle",
  bubble: { type: "hidden" },
  lastTool: null,
  queueCount: 0,

  applyAgentEvent: (event) => {
    if (event.type === "state") {
      set({
        state: event.state,
        bubble: event.message ? { type: "text", message: event.message } : { type: "hidden" }
      });
      return;
    }

    if (event.type === "tool") {
      set({
        state: "working",
        lastTool: event.toolName,
        bubble: { type: "text", message: event.summary ?? `正在使用 ${event.toolName}` }
      });
      return;
    }

    if (event.type === "permission") {
      set({
        state: "alert",
        bubble: {
          type: "permission",
          id: event.id,
          toolName: event.toolName,
          message: event.message
        }
      });
      return;
    }

    if (event.type === "result") {
      set((store) => ({
        state: "idle",
        queueCount: Math.max(0, store.queueCount - 1),
        bubble: { type: "text", message: event.message }
      }));
      return;
    }

    set({
      state: "error",
      bubble: { type: "text", message: event.message }
    });
  },

  markQueued: () => {
    set((store) => ({ queueCount: store.queueCount + 1 }));
  },

  resolvePermission: (id, allowed) => {
    window.virtualAssistant.respondPermission(id, allowed);
    set({
      state: "working",
      bubble: { type: "text", message: allowed ? "已允许，继续执行。" : "已拒绝，正在停止任务。" }
    });
  },

  hideTextBubble: () => {
    set((store) => ({
      bubble: store.bubble.type === "text" ? { type: "hidden" } : store.bubble
    }));
  },

  showTextBubble: (message) => {
    set({
      state: "idle",
      bubble: message.trim() ? { type: "text", message: message.trim() } : { type: "hidden" }
    });
  },

  showClipboardSuggestion: (suggestion) => {
    set({
      state: "alert",
      bubble: { type: "clipboard", suggestion }
    });
  },

  dismissBubble: () => {
    set({ bubble: { type: "hidden" } });
  }
}));
