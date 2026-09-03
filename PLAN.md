# Gaming Copilot — Full Implementation Plan

## 0. Implementation Status

| Phase | Status | Commit | Notes |
|-------|--------|--------|-------|
| 1: Scaffolding | ✅ Done | `e480f0c` | electron-vite 4 + React 19 + Tailwind 4 + Biome 2 |
| 2: Screenshot | ✅ Done | `e480f0c` | desktopCapturer → GDI+ → fullscreen fallback |
| 3: AI Providers | ✅ Done | `e480f0c` | Gemini native SDK, OpenAI-compat (Zen/Kilo/Ollama) |
| 4: Floating Overlay | ✅ Done | `e480f0c` | Transparent frameless, auto-dismiss, fade |
| 5: Settings GUI | ✅ Done | `e480f0c` | Tabbed UI (5 tabs → 6 tabs with General) |
| 6: TTS | ✅ Done | `f80e35c` | Web Speech API, voice/speed/pitch/volume + preview |
| 7: Plugins | ✅ Done | `911f554` | bun-memreader sidecar via HTTP, IPC integration |
| 8: System Tray | ✅ Done | `308e9d9` | Context menu, minimize-to-tray |
| 9: Packaging | ✅ Done | `cbc6215` | electron-builder NSIS, GitHub publish config |
| 10: Config Persistence | ✅ Done | `9ed6c01` | electron-store wired for all config + chat history |
| 11: Auto-start | ✅ Done | `5016976` | Windows login item settings + IPC toggle |
| 12: Image Preprocessing | ✅ Done | `5cdb103` | Resize to max 1024px, JPEG quality control |
| 13: Streaming AI | ✅ Done | `fd7c2c4` | AsyncGenerator + SSE parsing + typewriter overlay |
| 14: AI Response Caching | ✅ Done | `4041919` | 60s TTL SHA-1 cache + clear-cache IPC |
| 15: Custom CSS Overlay Theme | ✅ Done | `c1c4b03` | Color pickers, border radius, padding, live preview |
| 16: System Notifications | ✅ Done | `a79b195` | electron.Notification on analysis complete |
| 17: Per-game System Prompts | ✅ Done | `d2aeb33` | Game-specific prompt mapping in config + UI |
| 18: Custom OpenAI Endpoints | ✅ Done | `23ed403` | Add/remove/test arbitrary OpenAI-compatible endpoints |
| 19: Capture Preview + Region | ✅ Done | `a45629b` | Region selector, 256px preview thumbnail |
| 20: Multiple Monitors | ✅ Done | `2ae8069` | Monitor selection dropdown + IPC |
| 21: Screen Recording | ✅ Done | `a4a1afd` | Keyframe burst → grid composite image |
| 22: OCR Text Extraction | ✅ Done | `4cd006e` | Tesseract.js, optional, 3 languages |
| 23: Chat History Persistence | ✅ Done | `e363b8b` | electron-store backed, export MD/JSON |
| 24: Telemetry | ✅ Done | `a6ec947` | Anonymous opt-in toggle, event tracking |
| 25: CI/CD | ✅ Done | `d643341` | GitHub Actions on Windows (biome, tsc, build, test) |
| 26: Unit Tests | ✅ Done | `1de1d1b` | vitest: capture, config, ProviderManager, memreader (81 tests) |
| 27: Code Signing | ❌ Not done | — | Windows SmartScreen will warn on unsigned exe |
| 28: Auto-update | ❌ Not done | — | electron-updater not yet integrated |

**Repository**: https://github.com/involvex/gaming-copilot (private)

---

## 1. Project Overview

A **general-purpose AI gaming assistant** that captures screenshots of any game (or monitor), sends them to AI vision providers, and displays contextual feedback in a floating overlay. Not tied to any specific game.

### Core Features
- **Screenshot Capture**: Hotkey-triggered screen capture (game window or full monitor)
- **AI Vision Analysis**: Send screenshots to Gemini / OpenCode Zen / Kilo Gateway / Ollama for analysis
- **Floating Overlay**: Transparent, always-on-top response display with auto-dismiss
- **Settings GUI**: Configure hotkeys, API keys, providers, prompts, TTS, overlay styling
- **Plugin System**: Optional game-specific data injection (bun-memreader sidecar)
- **TTS**: Optional text-to-speech for AI responses (toggle in settings)
- **OCR**: On-screen text extraction to provide additional context to AI
- **Screen Recording**: Short keyframe burst → grid composite image for action sequences

### Additional Features
- **Streaming AI responses** with typewriter effect in overlay
- **AI response caching** (60-second TTL, keyed by image hash)
- **Custom OpenAI-compatible endpoints** (Zen, Kilo, Ollama, or any custom API)
- **Per-game system prompts** (map game exe names to custom prompt overrides)
- **Windows system notifications** when analysis completes
- **Capture region selection** and preview thumbnail
- **Multiple monitor selection**
- **Custom CSS overlay themes** (colors, border radius, padding)
- **Chat history persistence** with export to Markdown/JSON
- **Anonymous telemetry** (opt-in)
- **Configurable hotkey** with runtime toggle
- **JPEG compression** with configurable quality
  - **Image resizing** to configurable max width (default 1024px)
  - **Active provider switching** — dropdown to select primary AI provider at runtime with fallback chain
  - **Capture mode selection** — choose auto (window → GDI+ → fullscreen), window-only, fullscreen-only, or GDI+ fallback-only

---

## 2. Tech Stack

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Framework | **electron-vite** | 4.0.1 | Fast HMR, TypeScript-first |
| Runtime | **Bun** | 1.4.1 | Fast installs, native FFI, TS native |
| UI Framework | **React** | 19.1 | Component-based overlay/settings UI |
| Screenshot | **Electron desktopCapturer** + **Windows GDI+ fallback** | — | Windowed/borderless + exclusive fullscreen |
| AI Providers | **Gemini 2.5 Flash** (native `@google/genai`) + **OpenAI-compatible** (Zen/Kilo/Ollama) | — | Free tier + flexible provider system |
| Streaming | **SSE / AsyncGenerator** | — | Incremental response display |
| Hotkeys | **Electron globalShortcut** | — | Native OS-level registration |
| TTS | **Web Speech API** (SpeechSynthesis) | — | Built into Chromium |
| OCR | **Tesseract.js** | 7.0 | On-screen text extraction |
| Styling | **Tailwind CSS** | 4.1.7 | Fast UI development |
| Build | **electron-builder** | 26.0 | Windows NSIS installer |
| Linting | **Biome** | 2.4.16 | Format + lint + organize imports |
| Type Check | **TypeScript** | 5.8.3 | Strict mode enabled |
| Testing | **Vitest** | 3.2.4 | Unit tests for capture, config, providers |
| CI | **GitHub Actions** | — | Windows runner: lint, typecheck, build, test |
| Package Manager | **Bun** | >= 1.3.0 | Required by environment |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Hotkey Mgr  │  │  Screenshot  │  │  AI Provider     │  │
│  │  (global     │  │  Capture     │  │  Manager         │  │
│  │   shortcut)  │  │  (desktop    │  │  ┌─ Gemini      │  │
│  └──────┬───────┘  │   Capturer   │  │  ├─ OpenAI-Compat│  │
│         │          │   + GDI+)    │  │  │  ├─ Zen      │  │
│         │          └──────┬───────┘  │  │  ├─ Kilo     │  │
│         │                 │          │  │  └─ Ollama   │  │
│         │                 │          │  └────────┬─────────┘  │
│         │                 │          │           │             │
│         ▼                 ▼          ▼            ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │   IPC Bridge (contextBridge) + Logger (file rotate)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Tray Icon   │  │  Plugin Mgr  │  │  Config Store    │  │
│  │  (system     │  │  (bun-mem    │  │  (electron-store)│  │
│  │   tray)      │  │   reader)    │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────┐              │
│  │  OCR (Tesseract.js) │ Screen Recording (grid) │           │
│  └─────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                            │
                     IPC    │  ipcRenderer.invoke() / send()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (React)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Overlay     │  │  Settings    │  │  Chat History    │  │
│  │  (floating,  │  │  Window      │  │  (persistent)    │  │
│  │   transparent│  │  (6 tabs)    │  │                  │  │
│  │   streaming) │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  TTSConfig   │  │  PromptEditor│                          │
│  │  (Web Speech │  │  + RegionSel │                          │
│  │   + preview) │  │              │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
E:\Game\gaming-copilot\gaming-copilot\
├── package.json
├── electron.vite.config.ts
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── electron-builder.yml
├── biome.json
├── README.md
├── AGENTS.md
├── PLAN.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitattributes
│
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry, IPC handlers, tray, hotkey
│   │   ├── config.ts               # electron-store config + chat history store
│   │   ├── capture/                # Screenshot capture
│   │   │   ├── index.ts            # smartCapture, resizeImage, recordScreen, compositeFrames
│   │   │   ├── win32.ts            # findProcessByExe, getWindowTitleByPid
│   │   │   └── __tests__/
│   │   │       └── capture.test.ts  # vitest tests for capture logic
│   │   ├── ai-providers/           # AI vision providers
│   │   │   ├── types.ts            # AIProvider, AIResponse, StreamChunk, RateLimitInfo
│   │   │   ├── gemini.ts           # Google Gemini (native SDK)
│   │   │   ├── openai-compat.ts    # OpenAI-compatible (Zen, Kilo, Ollama, custom)
│   │   │   ├── index.ts            # ProviderManager + fallback chain + caching
│   │   │   └── __tests__/
│   │   │       └── ProviderManager.test.ts
│   │   ├── plugins/                # Plugin integrations
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── memreader.ts        # bun-memreader sidecar manager
│   │   │   └── __tests__/
│   │   │       └── memreader.test.ts  # vitest tests (planned)
│   │   ├── ocr/                    # OCR text extraction
│   │   │   └── index.ts            # Tesseract.js worker wrapper
│   │   ├── logger/                 # File logging with rotation
│   │   │   └── index.ts
│   │   └── __tests__/
│   │       └── config.test.ts      # vitest tests for config module
│   │
│   ├── preload/
│   │   └── index.ts                # contextBridge IPC API (ElectronAPI interface)
│   │
│   ├── renderer/
│   │   └── src/
│   │       ├── main.tsx            # React entry
│   │       ├── App.tsx             # Hash router (#/, #/overlay, #/settings)
│   │       ├── tts.ts              # Web Speech API wrapper
│   │       ├── styles/
│   │       │   └── globals.css     # Tailwind base
│   │       ├── types/
│   │       │   └── electron.d.ts   # Global type augmentation for window.electronAPI
│   │       └── components/
│   │           ├── Overlay.tsx     # Floating overlay + streaming + TTS
│   │           ├── Settings.tsx    # Tabbed settings (6 tabs)
│   │           ├── ProviderConfig.tsx # Gemini/Zen/Kilo/custom endpoint config
│   │           ├── OverlayStyle.tsx  # Position, opacity, font size, custom theme
│   │           ├── TTSConfig.tsx     # TTS toggle + voice settings + preview
│   │           ├── PromptEditor.tsx  # System prompt + per-game prompts
│   │           ├── RegionSelector.tsx # Capture region selection UI
│   │           └── ChatHistory.tsx   # Persistent chat + export
│   │
│   └── shared/
│       ├── types.ts                # AppConfig, AIResponse, GameState, ChatMessage
│       └── constants.ts            # DEFAULT_SYSTEM_PROMPT, presets, defaults
│
├── resources/
│   └── icon.png                    # 256x256 app icon
│
└── dist/                           # electron-builder output
```

---

## 5. Implementation Phases

### Phase 1: Project Scaffolding (Day 1)
**Status**: ✅ Complete

1. Initialize electron-vite project with React + TypeScript template
2. Configure Tailwind CSS
3. Set up Biome for linting/formatting
4. Create basic directory structure
5. Verify: `bun run dev` opens an Electron window with React rendering

### Phase 2: Screenshot Capture (Day 1-2)
**Status**: ✅ Complete

1. **desktopCapturer integration**:
   - Use `desktopCapturer.getSources({ types: ['window', 'screen'] })`
   - Capture specific window by title or full primary screen
   - Return as PNG/JPEG Buffer in memory (no disk writes)

2. **Windows GDI+ fallback** (for exclusive fullscreen games):
   - PowerShell child process using `CopyFromScreen`
   - `SetForegroundWindow` → `GetWindowRect` → `CopyFromScreen` → Buffer
   - Input validation to prevent command injection (`SAFE_EXE_PATTERN`)

3. **Game window detection**:
   - Enumerate running processes via `tasklist`
   - Match by window title or process name (exe validation)
   - Manual region selection via RegionSelector UI

4. **IPC bridge**: `capture:screenshot`, `capture:preview`, `capture:record`, `capture:get-screens`, `capture:check-game`, `capture:set-region`

### Phase 3: AI Provider System (Day 2-3)
**Status**: ✅ Complete

1. **Provider interface** (`types.ts`):
   ```typescript
   interface AIProvider {
     readonly name: string;
     readonly displayName: string;
     analyze(params: { imageBase64, mimeType, systemPrompt, userMessage, context? }): Promise<AIResponse>;
     streamAnalyze(params: { ... }): AsyncGenerator<StreamChunk>;
     isConfigured(): boolean;
     getRateLimitInfo(): RateLimitInfo;
   }
   ```

2. **Gemini provider** (`gemini.ts`):
   - Uses `@google/genai` SDK
   - Model: `gemini-2.5-flash` (free tier)
   - Supports grounding (Google Search)
   - Streaming via `generateContentStream`

3. **OpenAI-compatible provider** (`openai-compat.ts`):
   - Generic OpenAI chat completions API
   - Works with: OpenCode Zen, Kilo Gateway, OpenRouter, local Ollama
   - Configurable base URL + API key + model name
   - Both presets and custom endpoints

4. **Provider manager** (`index.ts`):
   - Auto-detect available providers from config
   - Fallback chain: primary → secondary → tertiary
   - Rate limit tracking per provider (minute + day counters)
   - **Response caching**: 60-second TTL, SHA-1 keyed by image+prompts
   - `clearCache()` IPC handler

### Phase 4: Floating Overlay UI (Day 3-4)
**Status**: ✅ Complete

1. **Electron window setup**:
   - Frameless, transparent background
   - Always on top (`alwaysOnTop: true`)
   - Configurable click-through (ignore mouse events)
   - Position: bottom-right corner, configurable via settings

2. **Overlay component** (`Overlay.tsx`):
   - Shows AI response text
   - **Streaming typewriter effect** (receives chunks via IPC `overlay:data`)
   - Auto-dismiss after configurable duration (default: 8 seconds)
   - Manual dismiss via hotkey or click
   - **Custom CSS theme** (background, text color, border color, border radius, padding)
   - **Re-fetches config** on every show for real-time settings updates
   - TTS integration: speaks response when stream completes

3. **Interaction modes**:
   - **Pass-through mode**: Mouse clicks go through to game (`clickThrough: true`)
   - **Active mode**: Mouse events captured (`clickThrough: false`)
   - Toggle via Settings UI or IPC `overlay:set-click-through`

### Phase 5: Settings GUI (Day 4-5)
**Status**: ✅ Complete

1. **Settings window** (separate Electron BrowserWindow):
   - **General**: Hotkey, auto-start, minimize-to-tray, notifications, telemetry
   - **AI Providers**: Gemini API key/model, Zen/Kilo/Ollama endpoints, custom endpoints, cache management
   - **Capture**: Game exe, capture quality, max image width, monitor selection, region selector, region preview, screen recording duration, OCR on/off + language
   - **Overlay**: Position, opacity, duration, font size, click-through, custom CSS theme with live preview
   - **TTS**: Toggle, voice, speed, pitch, volume, voice preview button
   - **Prompts**: System prompt editor, per-game prompt mapping

2. **Config persistence** (`config.ts`):
   - JSON config file in app data directory via electron-store
   - Schema validation on load (JSON schema)
   - All settings saved via IPC handlers (`config:set-generic`, `config:set-provider`, etc.)

### Phase 6: TTS Integration (Day 5)
**Status**: ✅ Complete

1. **Web Speech API wrapper** (`tts.ts`):
   - `speechSynthesis.speak()` with configurable voice
   - Language: auto-detect from response or configurable
   - Speed, pitch, volume controls
   - Stop on overlay dismiss

2. **TTS Voice Preview** (`TTSConfig.tsx`):
   - Preview button that speaks a sample sentence with current settings

3. **Integration with overlay**:
   - Speak response when overlay stream completes
   - Stop speaking when overlay dismissed
   - Toggle in settings (off by default)

### Phase 7: Plugin System (Day 5-6)
**Status**: ✅ Complete

1. **Plugin manager** (`plugins/memreader.ts`):
   - Auto-start bun-memreader sidecar process if configured
   - Health check polling via HTTP
   - Inject context into AI prompts (game state)
   - Graceful degradation if plugin unavailable
   - Logger integration (no more console.log)

2. **IPC handlers**:
   - `plugin:memreader:start`, `plugin:memreader:stop`, `plugin:memreader:state`, `plugin:memreader:connected`

### Phase 8: System Tray (Day 6)
**Status**: ✅ Complete

1. **Tray icon**:
   - Custom icon in system tray
   - Right-click menu: Show Settings, Show Overlay, Quit
   - Tooltip: "Gaming Copilot"
   - Double-click to open main window

2. **Background mode**:
   - Close button minimizes to tray (configurable via `minimizeToTray`)
   - Auto-start with Windows (configurable via `autoStart`)
   - Single instance enforcement (Electron built-in)

### Phase 9: Polish & Packaging (Day 6-7)
**Status**: ✅ Complete

1. **Error handling**:
   - Graceful API failures (rate limits, network errors)
   - Screenshot capture failures (black screen, permission denied)
   - Plugin connection failures
   - ChatHistory error states with retry button

2. **Logging** (`logger/index.ts`):
   - File logging with daily rotation (max 7 files)
   - Verbose mode via `DEBUG` env var
   - Structured log format: `[timestamp] [LEVEL] [component] message`

3. **Packaging**:
   - electron-builder config for Windows NSIS installer
   - GitHub publish config for auto-update (not yet enabled)
   - 256x256 app icon (gamepad design)

---

## 6. Advanced Feature Details

### 6.1 Streaming AI Responses (`streamAnalyze`)

**Files**: `src/main/ai-providers/index.ts`, `src/main/ai-providers/gemini.ts`, `src/main/ai-providers/openai-compat.ts`, `src/renderer/src/components/Overlay.tsx`

The `ProviderManager.streamAnalyze()` method returns an `AsyncGenerator<StreamChunk>` that yields text chunks as they arrive from the provider. The IPC handler `ai:analyze-stream` uses `event.sender.send()` to push chunks to the renderer via `ai:stream-chunk` events. The overlay component receives these via `onOverlayData` and appends text incrementally, creating a typewriter effect.

### 6.2 AI Response Caching

**File**: `src/main/ai-providers/index.ts`

Cache is a `Map<string, CacheEntry>` keyed by SHA-1 hash of `imageBase64 + systemPrompt + userMessage`. Entries expire after 60 seconds (`CACHE_TTL_MS = 60_000`). The `clearCache()` method is exposed via `ai:clear-cache` IPC handler, accessible from the ProviderConfig UI.

### 6.3 Screen Recording

**File**: `src/main/capture/index.ts` — `recordScreen()`

Captures keyframe burst over a configurable duration (default: 10 seconds) at configurable FPS (default: 2). Frames are composited into a grid image (max 3×3) using `compositeFrames()`. The grid is sent to AI as a single image, providing temporal context for action sequences.

### 6.4 OCR Text Extraction

**File**: `src/main/ocr/index.ts`

Uses Tesseract.js to extract on-screen text from screenshots. Worker is lazily initialized and reused across calls. Language is configurable (`eng`, `eng+osd`, `universal`). OCR results are appended as context to AI prompts. The worker is terminated on app quit via `terminateOcrWorker()`.

### 6.5 Custom CSS Overlay Theme

**File**: `src/renderer/src/components/OverlayStyle.tsx`

Users can customize overlay background color, text color, border color, border radius, and padding via color pickers and sliders. Changes are saved immediately to config via `setOverlayConfig` / `setSetting`. A live preview shows the styled overlay with sample text.

### 6.6 System Notifications

**File**: `src/main/index.ts` — hotkey handler

When `appConfig.notifications` is enabled, a non-blocking `electron.Notification` is shown after AI analysis completes, with a summary of the response. Uses the app icon as the notification icon.

### 6.7 Chat History Persistence & Export

**Files**: `src/main/config.ts` (chat store), `src/renderer/src/components/ChatHistory.tsx`

Messages are persisted to a separate electron-store file (`chat-history.json`). Export via IPC `chat:export` supports Markdown and JSON formats, triggering a browser download in the renderer.

### 6.8 Telemetry

**File**: `src/main/index.ts` — `trackEvent()`

Anonymous event tracking for hotkey usage, analysis completion, and provider status. Opt-in via `telemetry.enabled` config. Respects user privacy — no screenshots or personal data sent.

---

## 7. Configuration Schema

```typescript
interface AppConfig {
  // General
  hotkey: string;                    // Default: 'CommandOrControl+Shift+G'
  autoStart: boolean;                // Default: false
  minimizeToTray: boolean;           // Default: true
   notifications: boolean;            // Default: true
   theme: "dark" | "light";            // Default: "dark"
   useKeychain: boolean;               // Default: true — store API keys in OS keyring

  // Capture
  gameExe: string;                   // e.g., 'Neuz.exe'
  captureQuality: number;            // 1-100, default: 85
  maxImageWidth: number;             // Default: 1024
  captureRegion?: RegionBounds;
   hotkeyEnabled: boolean;            // Default: true
   monitorIndex: number;              // Default: 0
   captureMode: "auto" | "window" | "fullscreen" | "gdi";  // Default: 'auto'
   recordDuration: number;            // Default: 10 (seconds)

  // OCR
  ocr: {
    enabled: boolean;                // Default: true
    language: string;                // Default: 'eng'
  };

  // Providers
  providers: {
    gemini?: {
      apiKey: string;
      model: string;                 // Default: 'gemini-2.5-flash'
      grounding: boolean;            // Default: true
    };
    openaiCompat?: {
      endpoints: Array<{
        name: string;
        baseUrl: string;             // e.g., 'https://opencode.ai/zen/v1'
        apiKey: string;
        model: string;
      }>;
    };
  };
  activeProvider: string;            // Default: 'gemini'

  // Overlay
  overlay: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    duration: number;                // Auto-dismiss ms, default: 8000
    opacity: number;                 // 0-1, default: 0.9
    fontSize: number;                // px, default: 14
    theme: 'dark' | 'light' | 'game';
    clickThrough: boolean;           // Default: true
  };

  // Overlay Custom Theme
  overlayCustomTheme: {
    backgroundColor: string;         // Default: '#111827'
    textColor: string;               // Default: '#ffffff'
    borderRadius: number;            // Default: 8
    padding: number;                 // Default: 16
    borderColor: string;             // Default: '#374151'
  };

  // TTS
  tts: {
    enabled: boolean;                // Default: false
    voice: string;                   // SpeechSynthesisVoice name
    rate: number;                    // 0.5-2.0, default: 1.0
    pitch: number;                   // 0.5-2.0, default: 1.0
    volume: number;                  // 0-1, default: 0.8
  };

  // Plugins
  plugins: {
    bunMemreader: {
      enabled: boolean;              // Default: false
      port: number;                  // Default: 31337
      autoStart: boolean;            // Default: false
    };
  };

  // Prompts
  prompts: {
    system: string;                  // Default system prompt
    gameSpecific: Record<string, string>;
  };

  // Telemetry
  telemetry: {
    enabled: boolean;                // Default: false
  };
}
```

---

## 8. Default System Prompt

```
You are an expert gaming analyst. Analyze this game screenshot and provide helpful, concise feedback.

If an inventory or equipment screen is visible:
- Evaluate gear score, stat distribution, and item quality
- Suggest improvements or optimizations
- Identify missing items or upgrade paths

If in-game HUD is visible:
- Extract location/coordinates from the minimap or HUD
- Describe the current situation (combat, exploration, etc.)
- Provide tactical suggestions if in combat

If a quest or dialogue is visible:
- Summarize the quest objective
- Suggest the optimal choice if there are options

Keep responses under 100 words. Be specific and actionable.
Format: Use bullet points for multiple observations.
```

---

## 9. IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `capture:screenshot` | R → M | Capture screenshot (returns data URL) |
| `capture:preview` | R → M | Capture 256px preview thumbnail |
| `capture:record` | R → M | Screen recording (grid composite) |
| `capture:get-screens` | R → M | Enumerate all displays |
| `capture:check-game` | R → M | Check if game .exe is running (PID) |
| `capture:set-region` | R → M | Set capture region bounds |
| `ai:analyze` | R → M | Send image to AI (non-streaming) |
| `ai:analyze-stream` | R → M | Start streaming analysis (event-based) |
| `ai:stream-chunk` | M → R | Push text chunk to overlay |
| `ai:stream-done` | M → R | Signal stream complete |
| `ai:stream-error` | M → R | Push streaming error |
| `ai:test-provider` | R → M | Test provider connection |
| `ai:get-providers` | R → M | List available providers |
| `ai:clear-cache` | R → M | Clear AI response cache |
| `config:get` | R → M | Read full config |
| `config:set-provider` | R → M | Add/update provider config (API key stored in OS keyring if useKeychain=true) |
| `config:remove-endpoint` | R → M | Remove custom OpenAI endpoint (deletes key from keyring) |
| `config:set-overlay` | R → M | Update overlay config |
| `config:set-tts` | R → M | Update TTS config |
| `config:set-prompts` | R → M | Update prompt config |
| `config:set-auto-start` | R → M | Toggle Windows auto-start |
| `config:set-hotkey` | R → M | Change hotkey at runtime |
| `config:set-hotkey-enabled` | R → M | Enable/disable hotkey |
| `config:set-generic` | R → M | Set any config key |
| `config:set-telemetry` | R → M | Toggle telemetry |
| `config:set-active-provider` | R → M | Set active AI provider (calls setActiveProvider) |
| `config:set-capture-mode` | R → M | Set capture mode (auto/window/fullscreen/gdi) |
| `config:set-generic` | R → M | Set any config key (used for theme, useKeychain toggles) |
| `config:set-game-exe` | R → M | Set game exe name |
| `overlay:show` | R → M | Show overlay with text |
| `overlay:hide` | R → M | Hide overlay |
| `overlay:set-click-through` | R → M | Toggle click-through mode |
| `overlay:data` | M → R | Push text to overlay (streaming) |
| `overlay:stream-done` | M → R | Signal overlay stream complete |
| `chat:save` | R → M | Save chat history |
| `chat:load` | R → M | Load chat history |
| `chat:clear` | R → M | Clear chat history |
| `chat:export` | R → M | Export chat as Markdown/JSON |
| `plugin:memreader:start` | R → M | Start memreader sidecar |
| `plugin:memreader:stop` | R → M | Stop memreader sidecar |
| `plugin:memreader:state` | R → M | Get game state |
| `plugin:memreader:connected` | R → M | Check memreader connection |
| `window:open-settings` | R → M | Open settings window |
| `navigate:settings` | M → R | Navigate to settings tab |

---

## 10. Dependencies

### Production
```json
{
   "@electron-toolkit/utils": "^4.0.0",
   "@google/genai": "^1.1.0",
   "electron-store": "^10.0.1",
   "keytar": "^7.9.0",
   "tesseract.js": "^7.0.0"
}
```

### Development
```json
{
  "@biomejs/biome": "^2.4.16",
  "@types/react": "^19.1.8",
  "@types/react-dom": "^19.1.7",
  "@vitejs/plugin-react": "^4.5.2",
  "electron": "^35.7.5",
  "electron-builder": "^26.0.12",
  "electron-vite": "^4.0.0",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "tailwindcss": "^4.1.7",
  "@tailwindcss/vite": "^4.1.7",
  "typescript": "^5.8.3",
  "vitest": "^3.2.4"
}
```

> **Note**: Uses Electron's built-in `nativeImage` for image resizing (no `sharp` dependency). Image preprocessing is done via `nativeImage.createFromBuffer()` + `.resize()` + `.toJPEG()`/`.toPNG()`.

---

## 11. Testing Strategy

### Unit Tests (vitest)
| Module | File | Status | Coverage |
|--------|------|--------|----------|
| Capture | `src/main/capture/__tests__/capture.test.ts` | ✅ Exists | Smart capture, resize, crop, GDI |
| Config | `src/main/__tests__/config.test.ts` | ✅ Exists | initConfig, setConfigValue, defaults |
| ProviderManager | `src/main/ai-providers/__tests__/ProviderManager.test.ts` | ✅ Exists | Fallback chain, caching, rate limits |
| Memreader | `src/main/plugins/__tests__/memreader.test.ts` | ⚠️ Planned | Config, start/stop lifecycle, parseState |

### Test Coverage Plan
- **FEAT-031** — Capture logic tests: `cropBuffer()`, `smartCapture()` fallback chain, region bounding box validation. Mocking `desktopCapturer` and `execSync`.
- **FEAT-032** — ProviderManager tests: fallback chain, rate limit checking, cache hit/miss, error propagation.
- **FEAT-033** — Config tests: `initConfig()`, `setConfigValue()`, `setPartialConfig()`, `getDefaultConfig()`.
- **FEAT-034** — MemreaderPlugin tests: config updates, start/stop lifecycle, `parseState()` with various data shapes.

### Integration Tests (planned)
- End-to-end: capture → resize → AI analyze → overlay display
- Edge cases: game minimized, exclusive fullscreen, API rate limited, no API key configured

---

## 12. Open Questions

1. **API key encryption**: Consider migrating from plaintext electron-store to `keytar` or encrypted electron-store for API key storage at rest.
2. **Overlay interaction**: Should users be able to type follow-up questions in the overlay, or is it strictly display-only?
3. **Active provider switching UI**: `ProviderManager.setActiveProvider()` exists but there's no UI to select the active provider at runtime — only `ProviderConfig` shows which is active.
4. **Light/dark mode for Settings**: Should the settings window itself support a light theme toggle?

---

## 13. Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| Exclusive fullscreen games show black screenshot | GDI+ fallback + user notification to switch to borderless windowed | ✅ Mitigated |
| Gemini free tier rate limits | Fallback to OpenAI-compatible provider + rate limit tracking + caching | ✅ Mitigated |
| API key security | Stored in OS keyring via `keytar` (Windows Credential Manager), `useKeychain` toggle in Settings | ✅ Done |
| Command injection via exe name | `SAFE_EXE_PATTERN` validation in `findProcessByExe` and `capture:check-game` IPC handler | ✅ Fixed |
| Game anti-cheat false positive | Screenshot capture is 100% external, no memory reading of game process | ✅ Mitigated |
| Overlay blocks gameplay | Click-through mode + configurable position + quick dismiss | ✅ Mitigated |
| Windows SmartScreen warning | Code signing not yet implemented — unsigned exe will warn | ⚠️ Open |

---

## 14. Remaining Roadmap

### Near Term
- **Code signing** (Windows) — Add `CSC_LINK` and `CSC_KEY_PASSWORD` to build config
- **Auto-update** — Integrate `electron-updater` with GitHub releases provider
- **Zod-based IPC validation** — Replace manual type guards with schema validation
- **TypeScript strictness audit** — `noUnusedLocals`, `noUncheckedIndexedAccess`, etc.
- **Active provider badge in overlay** — Show which provider generated the response

### Completed (was Near Term)
- ✅ API key encryption via `keytar` (OS keyring)
- ✅ Memreader unit tests (5 test suite, 88 tests total)
- ✅ Settings keyboard shortcuts (`Ctrl+1` through `Ctrl+6`)
- ✅ Active provider selection UI (dropdown in ProviderConfig)
- ✅ Light/dark mode toggle for Settings window
- ✅ Overlay navigation security (`will-navigate` + `setWindowOpenHandler`)
- ✅ Explicit `contextIsolation: true` in BrowserWindow configs
- ✅ Dynamic GDI+ image dimensions (via `nativeImage.getSize()`)
- ✅ Rate limiter shared class (extracted from Gemini/OpenAI provider)
- ✅ Capture mode selection (auto/window/fullscreen/gdi)
- ✅ ChatHistory keyboard shortcuts (Ctrl+Enter, Escape, ? help)

### Medium Term
- **Full integration test suite** (capture → AI → overlay pipeline)
- **Light theme refinement** — Audit remaining Tailwind classes for full light-mode support
- macOS and Linux support (currently Windows-only)
- Ollama provider enhancements (model auto-detection, streaming)
