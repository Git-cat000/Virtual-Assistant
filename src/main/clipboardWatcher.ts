import { clipboard, type BrowserWindow } from "electron";
import type { ClipboardSuggestion } from "../shared/types";
import type { FeatureConfig } from "./featureConfig";

export class ClipboardWatcher {
  private readonly win: BrowserWindow;
  private readonly config: FeatureConfig["clipboard"];
  private timer: NodeJS.Timeout | null = null;
  private lastText = "";
  private pending = new Map<string, string>();

  constructor(win: BrowserWindow, config: FeatureConfig["clipboard"]) {
    this.win = win;
    this.config = config;
  }

  start() {
    if (!this.config.enabled || this.timer) return;
    this.lastText = clipboard.readText();
    this.timer = setInterval(() => this.check(), this.config.pollMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  consume(id: string) {
    const value = this.pending.get(id);
    this.pending.delete(id);
    return value;
  }

  private check() {
    const text = clipboard.readText().trim();
    if (!text || text === this.lastText) return;
    this.lastText = text;

    const kind = classifyClipboard(text);
    if (!kind) return;

    const id = crypto.randomUUID();
    this.pending.set(id, text);

    const suggestion: ClipboardSuggestion = {
      id,
      kind,
      preview: text.length > this.config.maxPreviewLength ? `${text.slice(0, this.config.maxPreviewLength)}...` : text
    };

    if (!this.win.isDestroyed()) {
      this.win.webContents.send("clipboard:suggestion", suggestion);
    }
  }
}

function classifyClipboard(text: string): ClipboardSuggestion["kind"] | null {
  if (/^https?:\/\/\S+/i.test(text)) return "link";
  if (/```|function\s+\w+|class\s+\w+|import\s+.+from|const\s+\w+\s*=|let\s+\w+\s*=|def\s+\w+\(|SELECT\s+.+FROM/i.test(text)) {
    return "code";
  }
  if (text.length >= 80 && text.length <= 4000) return "text";
  return null;
}
