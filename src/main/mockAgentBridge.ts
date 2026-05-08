import type { BrowserWindow } from "electron";
import type { AgentBridge, AgentBridgeCallbacks, EnqueueResult } from "./agentBridge";
import type { AgentUiEvent } from "../shared/types";

type PendingPermission = {
  resolve: (allowed: boolean) => void;
  timeout: NodeJS.Timeout;
};

type QueuedTask = {
  id: string;
  prompt: string;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockAgentBridge implements AgentBridge {
  private readonly win: BrowserWindow;
  private readonly callbacks: AgentBridgeCallbacks;
  private readonly queue: QueuedTask[] = [];
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private running = false;

  constructor(win: BrowserWindow, callbacks: AgentBridgeCallbacks = {}) {
    this.win = win;
    this.callbacks = callbacks;
  }

  enqueue(prompt: string): EnqueueResult {
    this.queue.push({ id: crypto.randomUUID(), prompt });
    const queued = this.running || this.queue.length > 1;
    void this.runNext();
    return { queued };
  }

  respondPermission(id: string, allowed: boolean) {
    const pending = this.pendingPermissions.get(id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingPermissions.delete(id);
    pending.resolve(allowed);
  }

  private async runNext() {
    if (this.running) return;

    const task = this.queue.shift();
    if (!task) return;

    this.running = true;

    try {
      this.callbacks.onTaskStart?.(task.id, task.prompt);
      await this.runTask(task);
    } catch (error) {
      this.callbacks.onTaskError?.(task.id, error instanceof Error ? error.message : "任务执行失败");
      this.emit({
        type: "error",
        message: error instanceof Error ? error.message : "任务执行失败"
      });
    } finally {
      this.running = false;
      if (this.queue.length > 0) {
        void this.runNext();
      }
    }
  }

  private async runTask(task: QueuedTask) {
    this.emit({ type: "state", state: "thinking", message: "正在分析你的任务..." });
    await delay(900);

    this.emit({ type: "tool", toolName: "Planner", summary: "拆解任务并检查执行边界" });
    await delay(900);

    const shouldAsk = /写|改|删|创建|执行|运行|文件|folder|file|delete|run/i.test(task.prompt);
    if (shouldAsk) {
      const allowed = await this.askPermission("MockWrite", {
        prompt: task.prompt,
        cwd: process.cwd()
      });

      if (!allowed) {
        this.emit({ type: "error", message: "你拒绝了这次工具调用，任务已停止。" });
        return;
      }
    }

    this.emit({ type: "state", state: "working", message: "正在模拟执行工具调用..." });
    await delay(1200);

    this.emit({
      type: "result",
      message: `Mock 任务完成：${task.prompt}`
    });
    this.callbacks.onTaskComplete?.(task.id, `Mock 任务完成：${task.prompt}`);
  }

  private askPermission(toolName: string, input: unknown): Promise<boolean> {
    const id = crypto.randomUUID();

    this.emit({
      type: "permission",
      id,
      toolName,
      input,
      message: `${toolName} 想执行一个会影响本地项目的操作。`
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPermissions.delete(id);
        resolve(false);
      }, 30000);

      this.pendingPermissions.set(id, { resolve, timeout });
    });
  }

  private emit(event: AgentUiEvent) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send("agent:event", event);
    }
  }
}
