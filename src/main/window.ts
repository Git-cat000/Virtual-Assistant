import { BrowserWindow, screen } from "electron";
import type { NativeImage } from "electron";
import { join } from "node:path";

type WindowPosition = {
  x: number;
  y: number;
};

type WindowStore = {
  get: (key: "windowPosition") => WindowPosition | undefined;
};

export function createPetWindow(store?: WindowStore, icon?: NativeImage): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const savedPosition = store?.get("windowPosition");

  const win = new BrowserWindow({
    width: 340,
    height: 430,
    x: savedPosition?.x ?? width - 390,
    y: savedPosition?.y ?? 80,
    title: "",
    icon,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.setMenu(null);
  win.setBackgroundColor("#00000000");
  win.setIgnoreMouseEvents(true, { forward: true });
  win.once("ready-to-show", () => {
    win.showInactive();
    win.setIgnoreMouseEvents(true, { forward: true });
  });
  win.on("blur", () => {
    win.setIgnoreMouseEvents(true, { forward: true });
  });
  return win;
}
