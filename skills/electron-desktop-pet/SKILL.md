---
name: electron-desktop-pet
description: Build and refine an Electron + React transparent desktop pet UI with mouse passthrough, hover input, speech bubbles, custom pet assets, and Windows-friendly behavior.
---

# Electron Desktop Pet Skill

Use this skill when building or improving a Windows desktop pet UI in Electron.

## Goals

- The visible experience should feel like only the pet exists, never a rectangular app window.
- Transparent window regions should not block the desktop.
- Input UI should appear only when the user intentionally hovers the pet or input area.
- Output bubbles should appear only when there is content to show.
- Pet assets should be replaceable without code changes.

## Recommended Architecture

```text
Electron Main
  - BrowserWindow transparent/frameless/alwaysOnTop
  - setIgnoreMouseEvents for passthrough
  - global cursor checks via screen.getCursorScreenPoint

Preload
  - minimal contextBridge API
  - no broad Node exposure

Renderer
  - React UI
  - pet body
  - input panel
  - output/permission bubble
  - custom asset manifest loader
```

## Window Rules

In `BrowserWindow`:

```ts
transparent: true,
frame: false,
alwaysOnTop: true,
skipTaskbar: true,
hasShadow: false,
backgroundColor: "#00000000",
show: false
```

After ready:

```ts
win.showInactive();
win.setIgnoreMouseEvents(true, { forward: true });
```

Recommended extras:

- Disable hardware acceleration if Windows shows transparent-window artifacts.
- Use `showInactive()` for tray/status re-show.
- On blur, restore mouse passthrough.
- Use `setBackgroundColor("#00000000")`.

## Mouse Interaction

Do not rely only on `mouseleave`; transparent windows can miss events.

Recommended approach:

1. Renderer keeps a ref to the interactive zone.
2. Renderer sends that zone rect to main.
3. Main compares it with `screen.getCursorScreenPoint()`.
4. If cursor is outside and input is empty, hide the input.

Preload API:

```ts
isCursorInWindowRect(rect)
setMouseInteractive(interactive)
```

Main behavior:

```ts
win.setIgnoreMouseEvents(!interactive, { forward: true });
```

## Input Behavior

- Hover pet or input area: show input.
- Leave area with empty input: hide input.
- Leave area with draft text: keep input open.
- Submit: clear input and hide.
- Shortcut toggle should also set mouse interactivity.

## Bubble Behavior

- Initial state should not show a bubble unless a configured greeting is enabled.
- Text/result/error bubbles auto-hide.
- Permission bubbles stay until the user chooses.
- Keep bubble styling compact and translucent.

## Custom Pet Assets

Use:

```text
src/renderer/public/pets/current/manifest.json
```

Support states:

```text
idle
thinking
working
alert
error
```

Support assets:

- image: png, webp, gif, apng, jpg
- video: webm, mp4
- lottie: json

Manifest example:

```json
{
  "states": {
    "idle": "idle.gif",
    "thinking": "thinking.gif",
    "working": "working.webm",
    "alert": "alert.png",
    "error": "error.png"
  }
}
```

Fallback should be a built-in CSS pet so the app always runs.

## Verification

Run:

```powershell
npm run build
npm run dev
```

Manual checks:

- Only pet body appears after launch.
- No white/gray rectangle appears after tray show/hide.
- Hover pet: input appears.
- Leave pet/input with no text: input disappears.
- Type text and leave: input stays.
- Submit: input disappears.
- Dragging works.
- Window position persists.

## Optional Panels

Keep panels off by default. Expose them through tray menu items:

- Settings panel for runtime config display.
- History panel for recent task status.

These panels should use the same transparent-window interactivity rules:

- pointer-events only on the panel itself
- `setMouseInteractive(true)` while open
- restore passthrough on close

## Clipboard Suggestions

Clipboard sensing should be opt-in, not enabled by default.

Recommended config:

```json
{
  "clipboard": {
    "enabled": false,
    "pollMs": 1200,
    "maxPreviewLength": 160
  }
}
```

When enabled:

- Detect links, code snippets, or long text.
- Show a compact bubble with accept/dismiss.
- Accept sends the clipboard content to the current Agent.
