# AGENTS.md

Instructions for AI agents working on this codebase.

## Build & Verify

```powershell
cd "E:\Game\gaming-copilot\gaming-copilot"
bun run build        # format + lint + typecheck + electron-vite build
bun run test         # vitest run (12 files, 177 tests)
bun run package      # build Windows installer
```

> **Test runner**: always use `bun run test` (vitest). Never use `bun test` —
> Bun's native runner lacks `vi.resetModules`/`vi.mocked` and ignores the
> JSDOM projects in `vitest.config.ts`, so renderer tests fail spuriously.

Always run `bun run build` before committing. It runs:
1. `biome format --write src/` — auto-format
2. `biome check src/` — lint
3. `tsc --noEmit` — type check
4. `electron-vite build` — production bundle

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, IPC handlers, tray, hotkey
│   ├── capture/             # Screenshot (desktopCapturer → GDI+ fallback)
│   ├── ai-providers/        # Gemini, OpenAI-compat (Zen/Kilo)
│   └── plugins/             # bun-memreader sidecar integration
├── preload/
│   └── index.ts             # contextBridge IPC API
├── renderer/
│   └── src/
│       ├── App.tsx          # Hash router (#/, #/overlay, #/settings)
│       ├── tts.ts           # Web Speech API wrapper
│       └── components/      # Overlay, Settings, ProviderConfig, etc.
└── shared/
    ├── types.ts             # AppConfig, AIResponse, GameState
    └── constants.ts         # DEFAULT_SYSTEM_PROMPT, presets, defaults
```

## Key Conventions

- **Package manager**: Bun (never npm/yarn/pnpm)
- **Shell**: PowerShell on Windows (no bash-only commands)
- **Formatting**: Biome 2 — `biome format --write src/`
- **Lint rules**: a11y label associations enforced — always use `htmlFor`/`id` on `<label>` + `<input>`
- **Type exports**: Biome requires type exports before value exports in barrel files
- **IPC pattern**: Main process handles via `ipcMain.handle()`, renderer calls via `window.electronAPI.*`
- **File paths**: Use forward slashes in Vite/config, backslashes in PowerShell

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `capture:screenshot` | R → M | Capture screenshot |
| `capture:check-game` | R → M | Check if game .exe is running |
| `ai:analyze` | R → M | Send image to AI |
| `ai:test-provider` | R → M | Test provider connection |
| `config:get` | R → M | Read config |
| `config:set-provider` | R → M | Update provider config |
| `overlay:show` | R → M | Show overlay with text |
| `overlay:hide` | R → M | Hide overlay |
| `plugin:memreader:start` | R → M | Start memreader sidecar |
| `plugin:memreader:stop` | R → M | Stop memreader sidecar |
| `plugin:memreader:state` | R → M | Get game state |
| `window:open-settings` | R → M | Open settings window |
| `window:minimize` | R → M | Minimize main window (custom title bar) |
| `window:toggle-maximize` | R → M | Toggle main window maximize (custom title bar) |
| `window:close` | R → M | Close main window (custom title bar) |
| `overlay:data` | M → R | Push text to overlay |
| `capture:result` | M → R | Push screenshot to renderer |
| `navigate:settings` | M → R | Navigate to settings tab |

## Common Tasks

### Adding a new IPC channel
1. Add handler in `src/main/index.ts` via `ipcMain.handle()`
2. Add method to `ElectronAPI` interface in `src/preload/index.ts`
3. Add implementation in `electronAPI` object in same file

### Adding a new settings tab
1. Create component in `src/renderer/src/components/`
2. Add tab type to `Tab` union in `Settings.tsx`
3. Add tab entry to `tabs` array and render condition

### Adding a new AI provider
1. Implement `AIProvider` interface in `src/main/ai-providers/`
2. Register in `ProviderManager` constructor in `src/main/ai-providers/index.ts`
3. Add config type to `AppConfig.providers` in `src/shared/types.ts`
