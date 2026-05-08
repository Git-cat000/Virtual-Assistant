# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start electron-vite dev server + Electron window
npm run build    # TypeScript type-check + electron-vite production build
npm run preview  # Preview production build
```

## Architecture Overview

Virtual Assistant is a Windows desktop pet-style AI assistant. Electron + React + TypeScript, with a transparent always-on-top window, CSS-animated pet, and a Mock AgentBridge simulating AI agent task flow.

### Process Model (3-layer Electron)

```
Renderer (React)  ←IPC→  Preload (contextBridge)  ←IPC→  Main (Electron)
```

- **Main process** (`src/main/`): Owns `BrowserWindow`, tray menu, global shortcuts (`Ctrl+Shift+Space`), `MockAgentBridge` (single-task queue), IPC handlers (`agent:run`, `agent:permission-response`, `window:move-by`). No real Claude SDK yet — currently a mock with delays.
- **Preload** (`src/preload/index.ts`): Exposes exactly 5 methods via `window.virtualAssistant` — `runAgent`, `respondPermission`, `moveBy`, `onAgentEvent` (returns unsubscribe), `onToggleInput` (returns unsubscribe). Context isolation enforced.
- **Renderer** (`src/renderer/`): React 18 app. Components are `PetCanvas` (draggable CSS pet with 5 animation states), `PetBubble` (text or permission confirmation), `ChatPanel` (input form). No Node access.

### State Management

Zustand store (`src/renderer/src/stores/petStore.ts`) holds:
- `state`: `"idle" | "thinking" | "working" | "alert" | "error"`
- `bubble`: hidden | text | permission request
- `lastTool`, `queueCount`

Events flow: Main sends `AgentUiEvent` via IPC → `useAgentEvents` hook dispatches to store → React re-renders.

### Shared Types (`src/shared/types.ts`)

```ts
AgentUiState = "idle" | "thinking" | "working" | "alert" | "error"

AgentUiEvent =
  | { type: "state"; state; message? }
  | { type: "tool"; toolName; summary? }
  | { type: "permission"; id; toolName; input; message }
  | { type: "result"; message; sessionId?; costUsd? }
  | { type: "error"; message }
```

### MockAgentBridge (`src/main/mockAgentBridge.ts`)

Simulates: `thinking → tool → permission (if write/delete/run) → working → result`. Permission requests block on a pending map with 30s timeout. Tool regex triggers permission on `/写|改|删|创建|执行|运行|文件|folder|file|delete|run/i`.

### Key patterns

- **Permission round-trip**: Main sends `permission` event → renderer shows bubble with allow/deny → user clicks → `respondPermission` IPC → Main resolves promise → agent continues or stops.
- **Drag**: `PetCanvas` tracks `mousedown/mousemove/mouseup`, sends `window:move-by` delta IPC to Main which calls `win.setPosition()`.
- **Window persistence**: electron-store saves/restores window position on move events.
- **Security**: CSP in `index.html` restricts `default-src 'self'`. Renderer has no Node/Electron access.

### Project maturity

Current phase: **local MVP with mock agent**. Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) integration planned — `query()` streaming and `canUseTool` permission callback will replace MockAgentBridge. See `agent.md` for the full design document.
