import type { BrowserWindow } from "electron";
import type { TaskHistoryItem } from "../shared/types";

const maxItems = 50;

export class TaskHistory {
  private readonly items: TaskHistoryItem[] = [];
  private win: BrowserWindow | null = null;

  attachWindow(win: BrowserWindow) {
    this.win = win;
  }

  all() {
    return [...this.items];
  }

  start(id: string, prompt: string) {
    const item: TaskHistoryItem = {
      id,
      prompt,
      status: "running",
      startedAt: new Date().toISOString()
    };

    this.items.unshift(item);
    this.trim();
    this.emit();
  }

  complete(id: string, summary?: string) {
    this.update(id, {
      status: "completed",
      endedAt: new Date().toISOString(),
      summary
    });
  }

  error(id: string, summary: string) {
    this.update(id, {
      status: "error",
      endedAt: new Date().toISOString(),
      summary
    });
  }

  private update(id: string, patch: Partial<TaskHistoryItem>) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;
    Object.assign(item, patch);
    this.emit();
  }

  private trim() {
    if (this.items.length > maxItems) {
      this.items.splice(maxItems);
    }
  }

  private emit() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send("task-history:updated", this.all());
    }
  }
}
