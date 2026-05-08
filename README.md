# Virtual Assistant

Virtual Assistant 是一个 Windows 本地桌面宠物式 AI 助手原型。当前项目先完成桌宠外壳、状态气泡、输入交互、权限确认和 Agent Bridge 抽象；默认使用 Mock Agent，不会连接真实 AI。需要时可以切换到本地 Claude Code / Claude Agent SDK。

完整产品方案见 [agent.md](agent.md)。本文档是当前工程的中文使用与配置手册。

## 目录

- [当前状态](#当前状态)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [Agent 接入](#agent-接入)
- [Agent 配置文件](#agent-配置文件)
- [Claude Code 工作目录](#claude-code-工作目录)
- [安全权限](#安全权限)
- [如何修改权限策略](#如何修改权限策略)
- [自定义桌面宠物](#自定义桌面宠物)
- [自定义助手名称和问候语](#自定义助手名称和问候语)
- [语音和 TTS 预留接口](#语音和-tts-预留接口)
- [剪贴板感知](#剪贴板感知)
- [任务历史和设置面板](#任务历史和设置面板)
- [打包发布](#打包发布)
- [显示和交互逻辑](#显示和交互逻辑)
- [项目结构](#项目结构)
- [复用 Skill 文档](#复用-skill-文档)
- [常见问题](#常见问题)

## 当前状态

已完成：

- Electron + React + TypeScript 工程骨架。
- 透明、无边框、置顶桌宠窗口。
- 透明区域鼠标穿透，只让桌宠、气泡、输入框可交互。
- CSS 占位桌宠动画，支持 `idle`、`thinking`、`working`、`alert`、`error` 状态。
- 系统托盘菜单：显示/隐藏、退出。
- 全局快捷键：`Ctrl+Shift+Space` 打开或关闭输入面板。
- 安全 preload API，Renderer 不直接访问 Node/Electron。
- Mock AgentBridge，模拟任务状态流和权限确认。
- Claude Code Bridge，按环境变量启用。
- 单任务队列。
- 窗口拖动与位置持久化。
- Windows 开发环境缓存目录隔离。
- 自定义桌宠资源目录，支持图片、动图、视频和 Lottie JSON。
- 自定义助手名称和启动问候语。

仍保留为后续扩展：

- 语音/TTS 目前只保留接口与配置示例，尚未绑定具体服务商。
- 更多 Agent Provider 预留了 `AgentBridge` 接口，可按同一事件协议继续扩展。
- 正式发布前建议补充 `.ico` 安装包图标和代码签名证书。

## 环境要求

- Windows 10/11
- Node.js 20+
- npm 10+

如果 Electron 下载较慢或失败，可以临时使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 快速开始

默认启动 Mock Agent，不连接真实 AI：

```powershell
npm install
npm run dev
```

启动后会出现一个 Electron 桌宠窗口。Renderer 开发服务地址通常是：

```text
http://localhost:5173/
```

这个地址只是 React 渲染进程的开发服务；真正要测试的是 Electron 打开的桌宠窗口。

常用命令：

```powershell
npm run dev
npm run build
npm run preview
npm run dist
npm run dist:dir
```

## Agent 接入

Agent 层通过统一接口隔离：

```text
src/main/agentBridge.ts
src/main/mockAgentBridge.ts
src/main/claudeCodeBridge.ts
```

默认使用 Mock Agent：

```powershell
npm run dev
```

启用 Claude Code / Claude Agent SDK：

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
npm run dev
```

建议显式指定工作目录：

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\demo\Virtual Assistant'
npm run dev
```

前置条件：

- 本机已完成 Claude Code 登录，或已配置 Anthropic 凭据。
- 项目已安装 `@anthropic-ai/claude-agent-sdk`。
- 真实 Agent 启用后，写文件、执行命令等危险操作会进入桌宠权限确认流程。

后续接入其它 Agent 产品时，只需要：

1. 新增一个实现 `AgentBridge` 的类。
2. 在 `src/main/index.ts` 的 `createAgentBridge()` 中根据环境变量选择它。
3. 将该 Agent 的状态、工具调用、权限请求映射为 `AgentUiEvent`。

## Agent 配置文件

Agent 默认配置在：

```text
config/agent.config.json
```

当前默认配置：

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

功能开关配置在：

```text
config/features.config.json
```

当前默认：

```json
{
  "clipboard": {
    "enabled": false,
    "pollMs": 1200,
    "maxPreviewLength": 160
  }
}
```

字段说明：

- `provider`：Agent 提供方，当前支持 `mock` 和 `claude-code`。
- `workspace`：Agent 工作目录，`.` 表示当前项目根目录。
- `claudeCode.permissionMode`：Claude Code 权限模式。
- `claudeCode.allowedTools`：自动允许的工具。
- `claudeCode.disallowedTools`：完全禁用的工具模式。
- `claudeCode.permissionTimeoutMs`：权限弹窗超时时间，单位毫秒。

环境变量优先级高于配置文件：

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\your\project'
npm run dev
```

也就是说，临时测试建议用环境变量；长期配置建议改 `config/agent.config.json`。

## Claude Code 工作目录

Claude Code 的工作目录由 `VIRTUAL_ASSISTANT_WORKSPACE` 或 `config/agent.config.json` 的 `workspace` 决定。

优先级：

1. 如果设置了 `VIRTUAL_ASSISTANT_WORKSPACE`，使用该目录。
2. 如果没有设置环境变量，使用 `config/agent.config.json` 的 `workspace`。
3. 如果配置文件也没有设置，使用启动应用时的 `process.cwd()`。
4. 当前默认配置里 `workspace` 是 `.`，因此开发环境默认工作目录就是：

```text
D:\demo\Virtual Assistant
```

当前没有配置 `additionalDirectories`，因此不会主动给 Claude Code 额外工作目录。Claude Code 仍可能通过用户授权的工具请求访问其它路径；这类操作会触发权限确认，是否允许由用户决定。

工作目录相关代码：

```text
src/main/index.ts
src/main/claudeCodeBridge.ts
src/main/agentConfig.ts
config/agent.config.json
```

## 安全权限

当前安全模型分为三层。

### 1. Electron 边界

Renderer 只负责 UI，不直接接触 Node、文件系统或 Electron 原生 API。

安全设置：

- `nodeIntegration: false`
- `contextIsolation: true`
- preload 只暴露最小 API
- Renderer 通过 `window.virtualAssistant` 与主进程通信

相关文件：

```text
src/main/window.ts
src/preload/index.ts
src/renderer/src/global.d.ts
```

### 2. Agent 工具权限

Claude Code 当前配置在：

```text
src/main/claudeCodeBridge.ts
```

当前策略：

```ts
permissionMode: "default",
tools: { type: "preset", preset: "claude_code" },
allowedTools: ["Read", "Glob", "Grep", "LS"],
disallowedTools: ["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"],
canUseTool: this.canUseTool
```

含义：

- `Read`、`Glob`、`Grep`、`LS`：自动允许，适合读取、搜索、列目录。
- 写入、编辑、执行命令等未自动允许的工具：走 `canUseTool`，由桌宠弹出权限气泡。
- `Bash(rm *)`、`Bash(del *)`、`Bash(rmdir *)`：显式禁用删除类命令。
- 权限请求 60 秒未处理时，默认拒绝。
- 用户点击拒绝时，返回 `behavior: "deny"` 并中断该工具调用。

权限确认流程：

```text
Claude Code 请求工具
  → canUseTool
  → Main 发送 permission 事件
  → Renderer 显示权限气泡
  → 用户点击允许/拒绝
  → Main 返回 allow/deny
  → Claude Code 继续或停止
```

### 3. 工作目录边界

当前 Claude Code 的 `cwd` 是 `VIRTUAL_ASSISTANT_WORKSPACE`、配置文件 `workspace` 或启动目录。

这意味着：

- Claude Code 默认从该目录理解项目。
- 项目内的 `CLAUDE.md` 和 `.claude/settings.json` 会影响它的行为。
- 如果你把工作目录指定到其它项目，它会在那个项目上下文内工作。

注意：工作目录不是强沙箱。真正的危险操作仍要靠工具权限、用户确认和系统权限共同约束。

## 如何修改权限策略

推荐优先修改配置文件：

```text
config/agent.config.json
```

如果需要改更深的逻辑，再修改代码：

```text
src/main/claudeCodeBridge.ts
src/main/agentConfig.ts
```

### 修改自动允许工具

当前默认配置：

```ts
allowedTools: ["Read", "Glob", "Grep", "LS"]
```

如果你希望自动允许编辑文件，可以在 `config/agent.config.json` 中改成：

```ts
allowedTools: ["Read", "Glob", "Grep", "LS", "Edit"]
```

不建议一开始这样做。更安全的方式是保持 `Edit` 走确认。

### 禁止更多命令

当前默认配置：

```ts
disallowedTools: ["Bash(rm *)", "Bash(del *)", "Bash(rmdir *)"]
```

可以继续增加：

```ts
disallowedTools: [
  "Bash(rm *)",
  "Bash(del *)",
  "Bash(rmdir *)",
  "Bash(format *)",
  "Bash(shutdown *)"
]
```

### 调整权限模式

当前默认配置：

```ts
permissionMode: "default"
```

常见选项：

- `default`：标准权限行为，推荐。
- `acceptEdits`：自动接受文件编辑，风险更高。
- `dontAsk`：不询问，未预批准则拒绝。
- `plan`：计划模式，不执行工具。
- `bypassPermissions`：跳过权限检查，不建议；需要额外开启危险开关。

建议开发阶段使用 `default`。如果只是让助手分析项目，不写文件，可以使用 `plan` 或限制 `tools`。

### 改成只读模式

如果你希望 Claude Code 完全只读，可以在代码里将 tools 改为：

```ts
tools: ["Read", "Glob", "Grep", "LS"],
allowedTools: ["Read", "Glob", "Grep", "LS"],
permissionMode: "dontAsk"
```

这样未预批准的工具会被拒绝。

### 设置工作目录

不改代码的方式：

```powershell
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\your\project'
```

改代码的方式：

```ts
return new ClaudeCodeBridge(win, "D:\\your\\project");
```

建议优先使用环境变量。

## 自定义桌面宠物

桌宠资源目录：

```text
src/renderer/public/pets/current/
```

配置文件：

```text
src/renderer/public/pets/current/manifest.json
```

默认配置：

```json
{
  "name": "Default CSS fallback",
  "states": {}
}
```

如果 `states` 为空，应用会尝试按约定文件名查找资源；找不到时回退到内置 CSS 桌宠。

### 支持的状态

```text
idle       空闲
thinking   思考
working    工作/工具调用
alert      需要确认/警告
error      错误
```

### 支持的资源格式

- 图片：`.png`、`.webp`、`.gif`、`.apng`、`.jpg`
- 视频：`.webm`、`.mp4`
- Lottie：`.json`

### 方式一：使用 manifest

示例：

```json
{
  "name": "My Pet",
  "states": {
    "idle": "idle.gif",
    "thinking": "thinking.gif",
    "working": "working.gif",
    "alert": "alert.png",
    "error": "error.png"
  }
}
```

文件结构：

```text
src/renderer/public/pets/current/
  manifest.json
  idle.gif
  thinking.gif
  working.gif
  alert.png
  error.png
```

### 方式二：显式声明资源类型

```json
{
  "states": {
    "idle": { "src": "idle.webm", "kind": "video" },
    "thinking": { "src": "thinking.json", "kind": "lottie" },
    "working": { "src": "working.gif", "kind": "image" }
  }
}
```

`kind` 可选：

```text
image
video
lottie
```

### 方式三：按约定文件名直接放入

不写 manifest 时，可以先放这些文件：

```text
idle.webp
thinking.webp
working.webp
alert.webp
error.webp
```

应用会尝试自动加载。缺少资源时会使用 CSS 回退。

### 资源尺寸建议

推荐：

- 正方形画布，例如 `512x512` 或 `1024x1024`
- 透明背景 PNG/WebP/GIF/APNG
- 主体居中，周围留一点透明边距
- 动图不要过大，避免 Electron 渲染卡顿
- 视频建议使用透明 WebM，如果需要透明背景

### 修改桌宠尺寸

主要样式在：

```text
src/renderer/src/styles.css
```

关键类：

```css
.app-shell
.pet-stage
.pet-hover-zone
.pet-button
.pet-canvas
```

如果把 `.pet-canvas` 从 `226px` 改大，也要同步调整 Electron 窗口大小：

```text
src/main/window.ts
```

关键字段：

```ts
width: 340,
height: 430
```

## 自定义助手名称和问候语

配置文件：

```text
src/renderer/public/assistant.config.json
```

默认配置：

```json
{
  "assistantName": "Virtual Assistant",
  "greeting": "你好，我是你的私人助手 Virtual Assistant",
  "showGreeting": true
}
```

说明：

- `assistantName`：助手名称。
- `greeting`：启动时显示的问候语。
- `showGreeting`：是否启动后显示问候语。

示例：

```json
{
  "assistantName": "小V",
  "greeting": "你好，我是你的私人助手小V",
  "showGreeting": true
}
```

关闭启动问候：

```json
{
  "assistantName": "Virtual Assistant",
  "greeting": "",
  "showGreeting": false
}
```

## 语音和 TTS 预留接口

当前项目不实现语音识别和语音播放，只保留文字转语音接入点，方便后续接第三方 TTS AI 服务。

预留接口：

```text
src/main/ttsProvider.ts
```

示例配置：

```text
config/tts.config.example.json
```

示例：

```json
{
  "enabled": false,
  "provider": "custom-http",
  "endpoint": "http://localhost:3001/tts",
  "voice": "default",
  "speed": 1
}
```

后续接入建议：

1. 新增一个实现 `TtsProvider` 的类。
2. 在输出气泡收到文本时调用 `speak({ text })`。
3. 将 API Key 放在环境变量或系统安全存储中，不要放进 Renderer 或 public 文件。
4. 给 UI 增加“静音/启用朗读”开关。

## 剪贴板感知

剪贴板感知默认关闭。开启后，应用会定时读取剪贴板文本，检测链接、代码片段或较长文本，并弹出简短建议气泡。

配置文件：

```text
config/features.config.json
```

开启方式：

```json
{
  "clipboard": {
    "enabled": true,
    "pollMs": 1200,
    "maxPreviewLength": 160
  }
}
```

行为：

- 检测到链接、代码或长文本时弹出剪贴板气泡。
- 点击 `✓` 会把剪贴板内容作为任务发给当前 Agent。
- 点击 `×` 忽略。
- 默认关闭，避免频繁打扰。

相关文件：

```text
src/main/clipboardWatcher.ts
src/main/featureConfig.ts
src/renderer/src/components/PetBubble.tsx
```

## 任务历史和设置面板

托盘菜单提供两个入口：

- `设置`：查看当前 Agent provider、工作目录、权限模式、自动允许工具、禁用工具。
- `任务历史`：查看最近任务、状态和摘要。

任务历史保存在当前运行进程内，最多保留 50 条；重启后会清空。后续如果需要持久化，可以把 `TaskHistory` 接入 `electron-store`。

相关文件：

```text
src/main/taskHistory.ts
src/renderer/src/components/SettingsPanel.tsx
src/renderer/src/components/HistoryPanel.tsx
```

## 打包发布

配置文件：

```text
electron-builder.yml
```

生成安装包和便携版：

```powershell
npm run dist
```

只生成解包目录，便于本地检查：

```powershell
npm run dist:dir
```

输出目录：

```text
release/
```

当前 Windows 目标：

- NSIS 安装包
- Portable 便携版

注意：

- 当前 `electron-builder.yml` 关闭了 Windows 代码签名和可执行文件资源编辑，适合本地测试与内部验证，避免无签名证书环境触发 `winCodeSign` 权限问题。
- 当前图标主要用于运行时托盘和窗口。正式发布前建议补充标准 `.ico` 安装包图标，并按证书供应商要求恢复签名配置。

## 显示和交互逻辑

- 启动后只显示桌宠本体。
- 启动问候语会短暂显示，然后自动收起。
- 普通输出气泡自动收起。
- 权限确认气泡会等待用户选择。
- 鼠标进入桌宠本体或输入框区域，输入框出现。
- 鼠标离开交互区域且输入框为空，输入框自动消失。
- 输入框隐藏不只依赖浏览器 `mouseleave`，还会通过主进程读取全局鼠标位置做兜底判断，避免透明窗口漏事件导致输入框残留。
- 如果输入框已有内容，不会自动消失，避免打断输入。
- 输入完成并提交后，输入框立即消失。
- 页面上不显示状态牌、队列牌、项目名称。
- 透明窗口区域启用鼠标穿透，避免桌宠外层矩形窗口挡住桌面。
- 窗口使用 `showInactive()` 显示，托盘唤醒时不主动聚焦，降低 Windows 透明窗口出现外框的概率。

## 项目结构

```text
Virtual Assistant/
  agent.md
  CLAUDE.md
  README.md
  package.json
  electron.vite.config.ts
  tsconfig.json
  config/
    agent.config.json
    features.config.json
    tts.config.example.json
  skills/
    electron-desktop-pet/SKILL.md
    claude-code-agent-bridge/SKILL.md
  src/
    main/
      index.ts
      window.ts
      agentBridge.ts
      agentConfig.ts
      clipboardWatcher.ts
      featureConfig.ts
      mockAgentBridge.ts
      claudeCodeBridge.ts
      appIcon.ts
      taskHistory.ts
      ttsProvider.ts
    preload/
      index.ts
    renderer/
      index.html
      public/
        assistant.config.json
        pets/current/manifest.json
      src/
        App.tsx
        styles.css
        components/
          HistoryPanel.tsx
          SettingsPanel.tsx
        hooks/
        stores/
    shared/
      types.ts
```

生成目录：

```text
node_modules/
out/
.runtime/
```

这些目录不需要手动维护，也不会提交。

## 复用 Skill 文档

本轮开发沉淀了两份可复用 skill 文档，存放在：

```text
skills/electron-desktop-pet/SKILL.md
skills/claude-code-agent-bridge/SKILL.md
```

用途：

- `electron-desktop-pet`：透明 Electron 桌宠窗口、鼠标穿透、hover 输入框、气泡、自定义宠物资源。
- `claude-code-agent-bridge`：Claude Code / Claude Agent SDK 接入、工作目录、权限策略、AgentBridge 抽象。

后续如果新开类似项目，可以优先阅读这两个 skill，再开始写代码。

## 常见问题

### Electron 下载失败

使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### 看到 Unable to move the cache

通常是 Electron 缓存目录被锁定或被 Windows 拒绝访问。项目把开发缓存放在：

```text
.runtime/electron-user-data/
```

关闭当前项目的 Electron/Node 进程：

```powershell
Get-Process electron,node | Stop-Process
```

必要时删除开发缓存：

```powershell
Remove-Item -Recurse -Force ".runtime"
npm run dev
```

### 启动 Claude Code 报找不到凭据

先确认本机 Claude Code 能单独运行，或 Anthropic 凭据已配置。然后再用：

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
npm run dev
```

### 不想让 Claude Code 写文件

把 `src/main/claudeCodeBridge.ts` 改成只读策略：

```ts
tools: ["Read", "Glob", "Grep", "LS"],
allowedTools: ["Read", "Glob", "Grep", "LS"],
permissionMode: "dontAsk"
```

### 想换桌宠但不想改代码

只改：

```text
src/renderer/public/pets/current/manifest.json
```

并把资源文件放到同目录。

## 开发原则

- 默认先用 Mock Agent 验证 UI。
- 真实 Agent 只通过 AgentBridge 接入，不直接耦合 Renderer。
- Renderer 不保存 API Key，不访问文件系统。
- 写入、编辑、命令执行、删除、覆盖类操作默认要经过权限确认。
- 不建议启用 `bypassPermissions`。
