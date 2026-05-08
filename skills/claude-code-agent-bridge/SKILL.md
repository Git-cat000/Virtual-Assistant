---
name: claude-code-agent-bridge
description: Connect a desktop assistant to Claude Code via Claude Agent SDK with explicit workspace configuration, permission prompts, safe default tools, and room for additional agent providers.
---

# Claude Code Agent Bridge Skill

Use this skill when connecting a desktop UI to Claude Code / Claude Agent SDK.

## Goals

- Keep UI and Agent execution separated.
- Make the Agent provider configurable.
- Make the workspace explicit.
- Route tool permission requests through the desktop UI.
- Default to safe permissions.
- Leave room for other Agent products.

## Recommended Files

```text
src/main/agentBridge.ts
src/main/mockAgentBridge.ts
src/main/claudeCodeBridge.ts
src/main/agentConfig.ts
config/agent.config.json
src/shared/types.ts
```

## Bridge Interface

```ts
export type EnqueueResult = {
  queued: boolean;
};

export interface AgentBridge {
  enqueue(prompt: string): EnqueueResult;
  respondPermission(id: string, allowed: boolean): void;
}
```

## Config File

Use:

```text
config/agent.config.json
```

Example:

```json
{
  "provider": "mock",
  "workspace": ".",
  "claudeCode": {
    "permissionMode": "default",
    "allowedTools": ["Read", "Glob", "Grep", "LS"],
    "disallowedTools": ["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"],
    "permissionTimeoutMs": 60000
  }
}
```

Keep feature switches in a separate config, for example:

```text
config/features.config.json
```

This avoids mixing runtime Agent permissions with optional UI sensors like clipboard watching.

Environment variables can override:

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\your\project'
npm run dev
```

## Claude SDK Query

Use `@anthropic-ai/claude-agent-sdk`.

Recommended query options:

```ts
query({
  prompt,
  options: {
    cwd: workspace,
    permissionMode: config.permissionMode,
    systemPrompt: { type: "preset", preset: "claude_code" },
    settingSources: ["user", "project", "local"],
    tools: { type: "preset", preset: "claude_code" },
    allowedTools: config.allowedTools,
    disallowedTools: config.disallowedTools,
    canUseTool
  }
});
```

## Permission Flow

Use `canUseTool`:

```text
Claude requests tool
  -> canUseTool
  -> main emits AgentUiEvent.permission
  -> renderer shows permission bubble
  -> user allows/denies
  -> main resolves pending permission
  -> SDK receives allow/deny
```

Allow result:

```ts
{ behavior: "allow", toolUseID, updatedPermissions }
```

Deny result:

```ts
{ behavior: "deny", message, interrupt: true, toolUseID }
```

Timeouts should deny by default.

## Safe Defaults

Recommended auto-allowed tools:

```ts
["Read", "Glob", "Grep", "LS"]
```

Recommended disallowed tools:

```ts
["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"]
```

Recommended permission mode:

```ts
"default"
```

For read-only mode:

```ts
tools: ["Read", "Glob", "Grep", "LS"],
allowedTools: ["Read", "Glob", "Grep", "LS"],
permissionMode: "dontAsk"
```

## Workspace Rules

- Prefer explicit workspace config.
- Default `.` should resolve from project root in development.
- Validate workspace exists before starting the bridge.
- Do not add `additionalDirectories` unless the user explicitly wants broader access.

## Message Mapping

Map SDK messages to UI events:

- assistant text -> `state: thinking`
- tool_use -> `type: tool`
- permission callback -> `type: permission`
- result success -> `type: result`
- result error/exception -> `type: error`

## Verification

Mock:

```powershell
npm run dev
```

Claude Code:

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\demo\Virtual Assistant'
npm run dev
```

Manual checks:

- Read-only prompts can complete without permission.
- Write/edit/Bash prompts show permission bubbles.
- Deny stops or redirects the operation.
- Timeout denies.
- Workspace is the configured directory.

## Task History

Track task history in main process:

```text
queued/running/completed/error
prompt
startedAt
endedAt
summary
```

Emit history updates through IPC so renderer panels can subscribe. Keep it in memory by default; persist only if the user asks for durable history.
