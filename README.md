# Gaming Copilot

AI-powered gaming assistant that captures screenshots of any game, sends them to vision AI providers, and displays contextual feedback in a floating overlay. Not tied to any specific game.

## Features

- **Screenshot Capture** — Hotkey-triggered (`Ctrl+Shift+G`), detects game window by `.exe` name with GDI+ fallback for fullscreen
- **AI Vision Analysis** — Gemini 2.5 Flash (native SDK), OpenCode Zen, Kilo Gateway, Ollama, or any custom OpenAI-compatible endpoint
- **Streaming Responses** — AI responses stream in real-time with a typewriter effect in the overlay
- **Floating Overlay** — Transparent, always-on-top, auto-dismiss with fade animations, configurable position/opacity/duration
- **OCR Text Extraction** — On-screen text extraction via Tesseract.js, included as context in AI prompts
- **Screen Recording** — Capture keyframe burst over a duration, composite into a grid image for action sequences
- **Image Preprocessing** — Auto-resize to configurable max width (default 1024px) with JPEG quality control
- **AI Response Caching** — 60-second TTL cache to reduce API calls on rapid re-captures
- **Per-game System Prompts** — Map game exe names to custom prompt overrides
- **Windows Notifications** — System tray notifications when analysis completes
- **Text-to-Speech** — Optional Web Speech API readout of AI responses with voice/speed/pitch controls + voice preview
- **System Tray** — Background operation, minimize-to-tray, context menu
- **Custom OpenAI-Compatible Endpoints** — Add Zen, Kilo, Ollama, or any custom API endpoint
- **Custom CSS Overlay Theme** — Color pickers for background, text, border; adjustable border radius and padding
- **Chat History** — Persistent chat log with export to Markdown or JSON
- **Anonymous Telemetry** — Opt-in usage analytics (hotkey usage, analysis frequency, provider status)
- **Multiple Monitor Selection** — Choose which display to capture when game is not detectable
- **Capture Region Selection** — Select a specific screen region to capture
- **Auto-start with Windows** — Launch Gaming Copilot automatically on Windows startup
- **Configurable Hotkey** — Rebind the screenshot hotkey at runtime, toggle on/off
- **Plugin System** — bun-memreader sidecar for game-specific memory reading (Dragon Crusade)
- **Active Provider Switching** — Select primary AI provider with automatic fallback to others
- **Capture Mode Selection** — Choose auto, window-only, fullscreen-only, or GDI+ fallback capture
- **API Key Encryption** — API keys stored in OS keyring (Windows Credential Manager) instead of plaintext
- **Light/Dark Theme** — Toggle between dark and light mode for the Settings window
- **Keyboard Shortcuts** — Ctrl+1–6 for Settings tabs, Ctrl+Enter to send, Escape to dismiss overlay, ? for help

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.0
- Windows 10/11
- An AI provider API key (Gemini recommended — free tier available)

## Quick Start

```powershell
cd gaming-copilot
bun install
bun run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Electron with hot reload |
| `bun run build` | Lint + typecheck + production build |
| `bun run package` | Build Windows NSIS installer |
| `bun run lint` | Check with Biome |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run format` | Format with Biome |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | Run unit tests with Vitest |

## Configuration

Open Settings from the tray icon or main window to configure six tabs:

1. **AI Providers** — Add Gemini API key, configure OpenCode Zen / Kilo Gateway / Ollama endpoints, or add custom OpenAI-compatible endpoints. Test connections and clear the AI response cache.
2. **Capture** — Enter your game's `.exe` name, adjust capture quality, set max image width, select monitor, choose OCR language, configure recording duration, preview capture region, toggle auto-start.
3. **Overlay** — Adjust position (4 corners), opacity, auto-dismiss duration, font size, click-through mode, and custom CSS theme (colors, border radius, padding) with live preview.
4. **TTS** — Enable text-to-speech with voice, rate, pitch, and volume controls. Use the preview button to test your voice settings.
5. **Prompts** — Edit the default system prompt and add per-game prompt overrides keyed by game exe name.
6. **General** — Toggle anonymous telemetry and export chat history as Markdown or JSON.

## Architecture

```
Electron Main Process
├── Capture (desktopCapturer → GDI+ → fullscreen fallback)
├── AI Providers (Gemini native SDK, OpenAI-compat for Zen/Kilo/Ollama/custom)
├── Streaming AI (AsyncGenerator, SSE parsing, typewriter overlay)
├── AI Response Cache (60s TTL, SHA-1 keyed)
├── System Tray (minimize-to-tray, context menu)
├── Plugin Manager (bun-memreader sidecar via HTTP)
├── OCR (Tesseract.js for on-screen text extraction)
├── Screen Recording (keyframe burst → grid composite)
├── Logger (file rotation, structured format)
└── Config Store (electron-store, all settings + chat history)

Renderer Process (React)
├── Overlay (transparent, always-on-top, streaming, custom theme)
├── Settings (6 tabs: providers/capture/overlay/tts/prompts/general)
├── Chat History (persistent, exportable)
└── TTS (Web Speech API + voice preview)
```

## Plugin: bun-memreader

Optional sidecar for Dragon Crusade memory reading. Provides real-time player state (HP, MP, level, position) injected into AI prompts.

```powershell
# Start the memreader server separately
cd ../bun-memreader
bun run bin/memreader.ts serve 31337
```

Enable in Settings → capture tab (Plugins section). The plugin auto-starts if configured and gracefully degrades if the sidecar is unavailable.

## Tech Stack

- **Electron 35** + **electron-vite 4** + **React 19** + **TypeScript 5** (strict mode)
- **Tailwind CSS 4** for UI styling
- **Biome 2** for linting and formatting
- **electron-builder 26** for Windows packaging (NSIS installer)
- **@google/genai** for Gemini API (native SDK)
- **Tesseract.js 7** for OCR text extraction
- **Vitest 3** for unit testing
- **electron-store** for config and chat history persistence
- **Bun** as runtime and package manager

## Development

```powershell
# Run tests
bun run test

# Lint and format
bun run lint
bun run format

# Build for production
bun run build

# Package Windows installer
bun run package
```

## License

MIT

## Author

involvex
