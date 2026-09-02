# Gaming Copilot

AI-powered gaming assistant that captures game screenshots, sends them to vision AI providers, and displays contextual feedback in a floating overlay.

## Features

- **Screenshot Capture** — Hotkey-triggered (`Ctrl+Shift+G`), detects game window by `.exe` name with GDI+ fallback for fullscreen
- **AI Vision Analysis** — Gemini 2.5 Flash (native SDK), OpenCode Zen, Kilo Gateway (OpenAI-compatible)
- **Floating Overlay** — Transparent, always-on-top, auto-dismiss with fade animations
- **Text-to-Speech** — Optional Web Speech API readout of AI responses
- **System Tray** — Background operation, minimize-to-tray, context menu
- **Plugin System** — bun-memreader sidecar for game-specific memory reading (Dragon Crusade)
- **Settings GUI** — Tabbed UI for providers, capture, overlay, TTS, and prompts

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

## Configuration

Open Settings from the tray icon or main window to configure:

1. **AI Providers** — Add your Gemini API key (get one at [aistudio.google.com](https://aistudio.google.com/apikey))
2. **Capture** — Enter your game's `.exe` name (e.g., `Neuz.exe`)
3. **Overlay** — Adjust position, opacity, font size, auto-dismiss duration
4. **TTS** — Enable text-to-speech with voice/speed/pitch controls
5. **Prompts** — Customize the system prompt for AI analysis

## Architecture

```
Electron Main Process
├── Capture (desktopCapturer → GDI+ → fullscreen fallback)
├── AI Providers (Gemini native SDK, OpenAI-compat for Zen/Kilo)
├── System Tray (minimize-to-tray, context menu)
├── Plugin Manager (bun-memreader sidecar via HTTP)
└── IPC Bridge (contextBridge)

Renderer Process (React)
├── Overlay (transparent, always-on-top, auto-dismiss)
├── Settings (tabbed GUI)
└── TTS (Web Speech API)
```

## Plugin: bun-memreader

Optional sidecar for Dragon Crusade memory reading. Provides real-time player state (HP, MP, level, position) injected into AI prompts.

```powershell
# Start the memreader server separately
cd ../bun-memreader
bun run bin/memreader.ts serve 31337
```

Enable in Settings → Plugins → bun-memreader.

## Tech Stack

- **Electron 35** + **electron-vite 4** + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** for UI styling
- **Biome 2** for linting and formatting
- **electron-builder** for Windows packaging
- **@google/genai** for Gemini API
- **Bun** as runtime and package manager

## License

MIT

## Author

involvex
