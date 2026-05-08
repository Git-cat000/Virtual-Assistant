import type { BrowserWindow } from "electron";
import { query, type CanUseTool, type PermissionResult, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentBridge, AgentBridgeCallbacks, EnqueueResult } from "./agentBridge";
import type { AgentRuntimeConfig } from "./agentConfig";
import type { AgentUiEvent } from "../shared/types";

type PendingPermission = {
  resolve: (allowed: boolean) => void;
  timeout: NodeJS.Timeout;
};

type QueuedTask = {
  id: string;
  prompt: string;
};

export class ClaudeCodeBridge implements AgentBridge {
  private readonly win: BrowserWindow;
  private readonly workspace: string;
  private readonly config: AgentRuntimeConfig["claudeCode"];
  private readonly callbacks: AgentBridgeCallbacks;
  private readonly queue: QueuedTask[] = [];
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private running = false;

  constructor(win: BrowserWindow, config: AgentRuntimeConfig, callbacks: AgentBridgeCallbacks = {}) {
    this.win = win;
    this.workspace = config.workspace;
    this.config = config.claudeCode;
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
      this.callbacks.onTaskError?.(task.id, error instanceof Error ? error.message : "Claude Code 任务执行失败");
      this.emit({
        type: "error",
        message: error instanceof Error ? error.message : "Claude Code 任务执行失败"
      });
    } finally {
      this.running = false;
      if (this.queue.length > 0) void this.runNext();
    }
  }

  private async runTask(task: QueuedTask) {
    this.emit({ type: "state", state: "thinking", message: "Claude Code 正在处理..." });

    const messages = query({
      prompt: task.prompt,
      options: {
        cwd: this.workspace,
        permissionMode: this.config.permissionMode,
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["user", "project", "local"],
        tools: { type: "preset", preset: "claude_code" },
        allowedTools: this.config.allowedTools,
        disallowedTools: this.config.disallowedTools,
        canUseTool: this.canUseTool
      }
    });

    for await (const message of messages) {
      this.handleMessage(message, task.id);
    }
  }

  private canUseTool: CanUseTool = async (toolName, input, options): Promise<PermissionResult> => {
    const allowed = await this.askPermission(toolName, input, options);

    if (allowed) {
      return {
        behavior: "allow",
        toolUseID: options.toolUseID,
        updatedPermissions: options.suggestions
      };
    }

    return {
      behavior: "deny",
      message: "用户拒绝了这次工具调用。",
      interrupt: true,
      toolUseID: options.toolUseID
    };
  };

  private askPermission(toolName: string, input: unknown, options: Parameters<CanUseTool>[2]): Promise<boolean> {
    const id = crypto.randomUUID();
    const message = options.title ?? options.description ?? `${options.displayName ?? toolName} 请求使用本地工具。`;

    this.emit({
      type: "permission",
      id,
      toolName: options.displayName ?? toolName,
      input: {
        input,
        blockedPath: options.blockedPath,
        reason: options.decisionReason
      },
      message
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPermissions.delete(id);
        resolve(false);
      }, this.config.permissionTimeoutMs);

      this.pendingPermissions.set(id, { resolve, timeout });
    });
  }

  private handleMessage(message: SDKMessage, taskId: string) {
    if (message.type === "assistant") {
      this.handleAssistantMessage(message);
      return;
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        this.emit({
          type: "result",
          message: message.result || "Claude Code 已完成。",
          sessionId: message.session_id,
          costUsd: message.total_cost_usd
        });
        this.callbacks.onTaskComplete?.(taskId, message.result || "Claude Code 已完成。");
      } else {
        this.callbacks.onTaskError?.(taskId, message.errors?.join("\n") || "Claude Code 返回错误。");
        this.emit({
          type: "error",
          message: message.errors?.join("\n") || "Claude Code 返回错误。"
        });
      }
      return;
    }

    if (message.type === "system" && "subtype" in message && message.subtype === "init") {
      this.emit({ type: "state", state: "thinking", message: "Claude Code 会话已启动。" });
    }
  }

  private handleAssistantMessage(message: Extract<SDKMessage, { type: "assistant" }>) {
    const content = message.message.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (!block || typeof block !== "object") continue;

      if ("type" in block && block.type === "text" && "text" in block && typeof block.text === "string") {
        const text = block.text.trim();
        if (text) {
          this.emit({ type: "state", state: "thinking", message: text });
        }
      }

      if ("type" in block && block.type === "tool_use") {
        const toolBlock = block as { name?: string; input?: unknown };
        this.emit({
          type: "tool",
          toolName: toolBlock.name ?? "Tool",
          summary: toolBlock.name ? `正在使用 ${toolBlock.name}` : "正在使用工具"
        });
      }
    }
  }

  private emit(event: AgentUiEvent) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send("agent:event", event);
    }
  }
}
