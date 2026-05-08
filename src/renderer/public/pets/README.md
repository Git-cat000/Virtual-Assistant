# Custom Pet Assets

Put custom desktop pet files in `src/renderer/public/pets/current/` and edit `manifest.json`.

Supported file types:

- Images: `.png`, `.webp`, `.gif`, `.apng`, `.jpg`
- Videos: `.webm`, `.mp4`
- Lottie: `.json`

Example:

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

You can also use explicit asset objects:

```json
{
  "states": {
    "idle": { "src": "idle.webm", "kind": "video" },
    "thinking": { "src": "thinking.json", "kind": "lottie" }
  }
}
```

If no asset is configured, the app uses the built-in CSS pet fallback.

For a quick drop-in test, put these files in `current/`:

```text
idle.webp
thinking.webp
working.webp
alert.webp
error.webp
```

The app will try those conventional names when `manifest.json` has no configured states.
