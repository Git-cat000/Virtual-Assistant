# Virtual Assistant

Virtual Assistant 是一个 Windows 本地桌面宠物式 AI 助手。当前版本重点完成桌宠外壳、简洁输入/输出气泡、设置窗口、任务历史、剪贴板感知开关，以及 Claude Code / Claude Agent SDK 的本地接入预留。

默认使用 Mock Agent，不会连接真实 AI。需要时可在设置页切换到 Claude Code。

## 功能状态

已完成：

- Electron + React + TypeScript 桌面应用。
- 透明、无边框、置顶桌宠窗口。
- 默认大白头部桌宠，带简易呼吸和眨眼动画。
- 鼠标进入桌宠区域时显示输入栏，鼠标离开且没有输入内容时自动隐藏。
- 仅在有输出内容、权限确认或提示时显示气泡。
- 独立设置窗口，可配置助手名称、问候语、Agent、工作区、Claude Code 权限、剪贴板感知和桌宠资源。
- 支持导入 Codex 桌宠文件夹，读取 `pet.json` 和 `spritesheet.webp`。
- 支持图片、GIF/APNG/WebP、视频、Lottie 和 Codex spritesheet 桌宠资源。
- Claude Code Bridge 已接入，可通过设置启用。
- Windows 安装包和 portable 包构建。

暂未完成：

- 语音识别和 TTS 仅保留接口设计，尚未绑定具体第三方 AI 服务。
- 更多 Agent Provider 需要后续按 `AgentBridge` 接口扩展。

## 环境要求

- Windows 10/11
- Node.js 20+
- npm 10+
- 可选：Claude Code 本地环境
- 可选：GitHub CLI，用于发布 release

如果 Electron 下载较慢，可以临时使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 快速开始

```powershell
npm install
npm run dev
```

常用命令：

```powershell
npm run dev       # 开发运行
npm run build     # 类型检查和构建
npm run dist      # 生成 Windows 安装包和 portable 包
npm run dist:dir  # 只生成解包目录，便于本地检查
```

打包输出目录：

```text
release/
```

## 设置入口

启动后在系统托盘右击 Virtual Assistant 图标，选择“设置”。

设置页可修改：

- 助手名称和启动问候语。
- Agent Provider：`mock` 或 `claude-code`。
- Agent 工作区。
- Claude Code 权限模式、自动允许工具、禁止工具和权限超时时间。
- 是否启用剪贴板感知。
- 导入 Codex 桌宠文件夹。

开发环境下，配置主要写入项目内的 `config/` 和 `src/renderer/public/`。安装版会写入 Electron `userData` 目录，避免安装目录不可写。

## Claude Code 工作目录

Claude Code 的工作目录不是固定为本项目目录，而是由用户配置决定。

优先级如下：

1. 如果设置了环境变量 `VIRTUAL_ASSISTANT_WORKSPACE`，使用该目录。
2. 否则使用设置页或 `config/agent.config.json` 中的 `workspace`。
3. 如果没有保存过配置：
   - 开发环境默认使用当前启动项目目录。
   - 安装版默认使用当前用户主目录。

推荐安装后第一时间在设置页选择你真正希望 Claude Code 操作的项目目录，例如：

```text
D:\projects\my-app
C:\Users\your-name\Documents\work
```

也可以通过环境变量临时指定：

```powershell
$env:VIRTUAL_ASSISTANT_AGENT='claude-code'
$env:VIRTUAL_ASSISTANT_WORKSPACE='D:\projects\my-app'
npm run dev
```

注意：工作目录只是 Claude Code 的默认上下文，不是强沙箱。文件读取、编辑、命令执行等风险操作仍需要结合 Claude Code 权限、应用内权限确认和系统权限共同控制。

## Claude Code 权限

默认配置：

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

含义：

- `Read`、`Glob`、`Grep`、`LS` 默认允许，适合读取和检索项目。
- 写文件、执行命令等高风险操作会进入权限确认流程。
- 删除类命令默认禁止。
- 权限请求 60 秒未处理时默认拒绝。

不建议在日常使用中开启 `bypassPermissions`。如果只想让 Agent 分析项目而不修改文件，可以限制为只读工具，并使用更保守的权限模式。

## 自定义桌宠

### 使用设置页导入 Codex 桌宠

在设置页点击导入 Codex 桌宠文件夹，选择包含以下文件的目录：

```text
pet.json
spritesheet.webp
```

应用会复制该文件夹，并更新当前桌宠配置。Codex spritesheet 会优先读取 `pet.json` 中的尺寸和动画配置；如果没有明确写单帧尺寸，应用会尝试读取 WebP 真实宽高并推断网格。

推荐在 `pet.json` 中明确写入：

```json
{
  "spritesheetPath": "spritesheet.webp",
  "frameWidth": 256,
  "frameHeight": 234,
  "columns": 6,
  "rows": 8,
  "displayScale": 0.38,
  "animations": {
    "idle": [0, 1, 2, 3, 4, 5],
    "hover": [18, 19, 20, 21],
    "thinking": [30, 31, 32, 33, 34, 35],
    "working": [6, 7, 8, 9, 10, 11],
    "alert": [18, 19, 20, 21],
    "error": [30, 31, 32, 33, 34, 35]
  }
}
```

### 使用普通资源

也可以修改：

```text
src/renderer/public/pets/current/manifest.json
```

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

支持的资源类型：

- 图片：`.png`、`.webp`、`.gif`、`.apng`、`.jpg`
- 视频：`.webm`、`.mp4`
- Lottie：`.json`
- Codex spritesheet：`pet.json` + `spritesheet.webp`

如果没有配置桌宠资源，应用会使用内置的大白头部 CSS 桌宠。

## 显示和交互逻辑

- 启动后只显示桌宠本体。
- 鼠标进入桌宠区域时显示输入栏。
- 鼠标离开且输入栏为空时，输入栏自动隐藏。
- 输入内容后不会因为鼠标离开而丢失。
- 提交任务后输入栏立即隐藏。
- 输出、权限确认和剪贴板建议通过简洁气泡显示。
- 透明窗口区域默认鼠标穿透，减少挡住桌面的问题。

## 剪贴板感知

剪贴板感知默认关闭。开启后，应用会定时读取剪贴板文本，检测链接、代码片段或较长文本，并显示简短建议。

配置文件：

```text
config/features.config.json
```

示例：

```json
{
  "clipboard": {
    "enabled": true,
    "pollMs": 1200,
    "maxPreviewLength": 160
  }
}
```

## TTS 预留

当前项目没有绑定具体文字转语音服务，只保留接口：

```text
src/main/ttsProvider.ts
config/tts.config.example.json
```

后续接入时建议把 API Key 放在环境变量或系统安全存储中，不要放在 Renderer 或 public 文件中。

## 项目结构

```text
Virtual Assistant/
  README.md
  package.json
  electron-builder.yml
  config/
    agent.config.json
    features.config.json
    tts.config.example.json
  src/
    main/
      index.ts
      window.ts
      agentBridge.ts
      claudeCodeBridge.ts
      mockAgentBridge.ts
      settingsManager.ts
    preload/
      index.ts
    renderer/
      public/
        assistant.config.json
        pets/current/manifest.json
      src/
        App.tsx
        styles.css
        components/
        hooks/
        stores/
    shared/
      types.ts
```

不会提交的目录：

```text
node_modules/
out/
release/
.runtime/
```

## 打包发布

生成安装包和 portable 包：

```powershell
npm run dist
```

生成后检查：

```text
release/
```

当前 Windows 构建关闭了代码签名，适合本地测试和早期分发。正式公开分发前建议补充 `.ico` 安装图标和代码签名证书。

## 发布到 GitHub Release

确保已经登录 GitHub CLI：

```powershell
gh auth status
```

创建 tag 并发布：

```powershell
git add .
git commit -m "Prepare release"
git push origin main
git tag v0.1.0
git push origin v0.1.0
gh release create v0.1.0 release/* --title "Virtual Assistant v0.1.0" --notes "Initial Windows preview release."
```

如果同名 release 已存在，可以改用：

```powershell
gh release upload v0.1.0 release/* --clobber
```

## 常见问题

### 看到 Unable to move the cache

通常是 Electron 缓存目录被锁定或被 Windows 拒绝访问。开发环境缓存目录位于：

```text
.runtime/electron-user-data/
```

可先关闭 Electron/Node 进程，再删除 `.runtime` 后重试。

### Codex 宠物显示错位

优先确认 `pet.json` 中是否写明：

```text
frameWidth
frameHeight
columns
rows
```

如果缺少这些字段，应用会根据 WebP 宽高推断，但社区宠物图集并不总是完全规则，显式配置会更稳定。

### 安装后 Claude Code 在哪里工作

打开托盘菜单中的设置页，查看并修改“工作区”。安装版默认不会使用本仓库路径，开发者和普通用户应设置为自己的项目目录。
