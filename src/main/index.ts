import { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, Tray } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Store from "electron-store";
import { loadAgentConfig } from "./agentConfig";
import { createAppIcon } from "./appIcon";
import { ClipboardWatcher } from "./clipboardWatcher";
import type { AgentBridge } from "./agentBridge";
import { ClaudeCodeBridge } from "./claudeCodeBridge";
import { loadFeatureConfig } from "./featureConfig";
import { createPetWindow } from "./window";
import { MockAgentBridge } from "./mockAgentBridge";
import { TaskHistory } from "./taskHistory";
import type { AppRuntimeInfo, PermissionResponse, WindowRect } from "../shared/types";

type AppSettings = {
  windowPosition?: {
    x: number;
    y: number;
  };
};

let petWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let bridge: AgentBridge | null = null;
let clipboardWatcher: ClipboardWatcher | null = null;
const taskHistory = new TaskHistory();

app.disableHardwareAcceleration();
configureAppStorage();
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const store = new Store<AppSettings>();
const appIcon = createAppIcon();
const agentConfig = loadAgentConfig();
const featureConfig = loadFeatureConfig();

function configureAppStorage() {
  const root = app.isPackaged
    ? join(app.getPath("appData"), "Virtual Assistant")
    : join(process.cwd(), ".runtime", "electron-user-data");
  const sessionData = join(root, "session");
  const cache = join(root, "cache");

  mkdirSync(sessionData, { recursive: true });
  mkdirSync(cache, { recursive: true });

  app.setName("Virtual Assistant");
  app.setPath("userData", root);
  app.setPath("sessionData", sessionData);
  app.commandLine.appendSwitch("disk-cache-dir", cache);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

  return root;
}

function createTray(win: BrowserWindow) {
  const icon = appIcon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Virtual Assistant");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "设置",
        click: () => {
          win.showInactive();
          win.webContents.send("ui:toggle-settings");
        }
      },
      {
        label: "任务历史",
        click: () => {
          win.showInactive();
          win.webContents.send("ui:toggle-history");
        }
      },
      {
        label: "显示/隐藏",
        click: () => {
          if (win.isVisible()) {
            win.hide();
          } else {
            win.showInactive();
            win.setIgnoreMouseEvents(true, { forward: true });
          }
        }
      },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
}

function registerIpc(win: BrowserWindow) {
  ipcMain.handle("agent:run", async (_, prompt: string) => {
    if (!prompt.trim()) return { queued: false };
    return bridge?.enqueue(prompt.trim()) ?? { queued: false };
  });

  ipcMain.on("agent:permission-response", (_, response: PermissionResponse) => {
    bridge?.respondPermission(response.id, response.allowed);
  });

  ipcMain.on("window:move-by", (_, { dx, dy }: { dx: number; dy: number }) => {
    const [x, y] = win.getPosition();
    const nextX = Math.round(x + dx);
    const nextY = Math.round(y + dy);
    win.setPosition(nextX, nextY);
    store.set("windowPosition", { x: nextX, y: nextY });
  });

  ipcMain.on("window:set-mouse-interactive", (_, interactive: boolean) => {
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  });

  ipcMain.handle("window:is-cursor-in-rect", (_, rect: WindowRect) => {
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const left = bounds.x + rect.left;
    const right = bounds.x + rect.right;
    const top = bounds.y + rect.top;
    const bottom = bounds.y + rect.bottom;

    return cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;
  });

  ipcMain.handle("task-history:get", () => taskHistory.all());

  ipcMain.handle("runtime:get-info", (): AppRuntimeInfo => ({
    provider: agentConfig.provider,
    workspace: agentConfig.workspace,
    permissionMode: agentConfig.claudeCode.permissionMode,
    allowedTools: agentConfig.claudeCode.allowedTools,
    disallowedTools: agentConfig.claudeCode.disallowedTools
  }));

  ipcMain.handle("clipboard:accept-suggestion", (_, id: string) => {
    const content = clipboardWatcher?.consume(id);
    if (!content) return;
    bridge?.enqueue(`请处理以下剪贴板内容：\n\n${content}`);
  });
}

async function initializeApp() {
  petWindow = createPetWindow(store, appIcon);
  taskHistory.attachWindow(petWindow);
  bridge = createAgentBridge(petWindow);
  clipboardWatcher = new ClipboardWatcher(petWindow, featureConfig.clipboard);
  registerIpc(petWindow);
  createTray(petWindow);
  clipboardWatcher.start();

  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    petWindow?.webContents.send("ui:toggle-input");
  });

  if (!shortcutRegistered) {
    petWindow.webContents.once("did-finish-load", () => {
      petWindow?.webContents.send("agent:event", {
        type: "error",
        message: "快捷键 Ctrl+Shift+Space 注册失败，可能已被其他应用占用。"
      });
    });
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    await petWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await petWindow.loadFile(joinRendererIndex());
  }
}

function createAgentBridge(win: BrowserWindow): AgentBridge {
  const callbacks = {
    onTaskStart: (id: string, prompt: string) => taskHistory.start(id, prompt),
    onTaskComplete: (id: string, summary?: string) => taskHistory.complete(id, summary),
    onTaskError: (id: string, message: string) => taskHistory.error(id, message)
  };

  if (agentConfig.provider === "claude-code") {
    return new ClaudeCodeBridge(win, agentConfig, callbacks);
  }

  return new MockAgentBridge(win, callbacks);
}

function joinRendererIndex() {
  return join(__dirname, "../renderer/index.html");
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(initializeApp);

  app.on("second-instance", () => {
    if (!petWindow) return;
    if (petWindow.isMinimized()) petWindow.restore();
    petWindow.showInactive();
    petWindow.setIgnoreMouseEvents(true, { forward: true });
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void initializeApp();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
