import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { AgentProvider } from "../shared/types";

export type AgentRuntimeConfig = {
  provider: AgentProvider;
  workspace: string;
  claudeCode: {
    permissionMode: PermissionMode;
    allowedTools: string[];
    disallowedTools: string[];
    permissionTimeoutMs: number;
  };
};

type AgentConfigFile = {
  provider?: AgentProvider;
  workspace?: string;
  claudeCode?: {
    permissionMode?: PermissionMode;
    allowedTools?: string[];
    disallowedTools?: string[];
    permissionTimeoutMs?: number;
  };
};

const defaultConfig: AgentRuntimeConfig = {
  provider: "mock",
  workspace: process.cwd(),
  claudeCode: {
    permissionMode: "default",
    allowedTools: ["Read", "Glob", "Grep", "LS"],
    disallowedTools: ["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"],
    permissionTimeoutMs: 60000
  }
};

export function loadAgentConfig(): AgentRuntimeConfig {
  const fileConfig = readAgentConfigFile();
  const provider = normalizeProvider(process.env.VIRTUAL_ASSISTANT_AGENT) ?? fileConfig.provider ?? defaultConfig.provider;
  const configuredWorkspace = process.env.VIRTUAL_ASSISTANT_WORKSPACE?.trim() || fileConfig.workspace || defaultConfig.workspace;
  const workspace = resolve(configuredWorkspace);

  if (!existsSync(workspace)) {
    throw new Error(`Agent workspace does not exist: ${workspace}`);
  }

  return {
    provider,
    workspace,
    claudeCode: {
      permissionMode: fileConfig.claudeCode?.permissionMode ?? defaultConfig.claudeCode.permissionMode,
      allowedTools: fileConfig.claudeCode?.allowedTools ?? defaultConfig.claudeCode.allowedTools,
      disallowedTools: fileConfig.claudeCode?.disallowedTools ?? defaultConfig.claudeCode.disallowedTools,
      permissionTimeoutMs: fileConfig.claudeCode?.permissionTimeoutMs ?? defaultConfig.claudeCode.permissionTimeoutMs
    }
  };
}

function readAgentConfigFile(): AgentConfigFile {
  const configPath = resolve(process.cwd(), "config", "agent.config.json");
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as AgentConfigFile;
  } catch (error) {
    throw new Error(`Failed to read agent config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeProvider(provider?: string): AgentProvider | undefined {
  const value = provider?.trim().toLowerCase();
  if (value === "mock") return "mock";
  if (value === "claude-code" || value === "claude") return "claude-code";
  return undefined;
}
