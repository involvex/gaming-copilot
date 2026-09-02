# Gaming Copilot — Full Implementation Plan

## 1. Project Overview

A **general-purpose AI gaming assistant** that captures screenshots of any game (or monitor), sends them to AI vision providers, and displays contextual feedback in a floating overlay. Not tied to any specific game.

### Core Features
- **Screenshot Capture**: Hotkey-triggered screen capture (game window or full monitor)
- **AI Vision Analysis**: Send screenshots to Gemini / OpenCode Zen / Kilo Gateway for analysis
- **Floating Overlay**: Transparent, always-on-top response display with auto-dismiss
- **Settings GUI**: Configure hotkeys, API keys, providers, prompts, TTS, overlay styling
- **Plugin System**: Optional game-specific data injection (bun-memreader sidecar)
- **TTS**: Optional text-to-speech for AI responses (toggle in settings)

---

## 2. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | **electron-vite** | Fast HMR, TypeScript-first, Vite ecosystem |
| Runtime | **Bun** | Fast installs, native FFI, TypeScript native |
| UI Framework | **React 18** + TypeScript | Component-based overlay/settings UI |
| Screenshot | **Electron desktopCapturer** + **Windows GDI+ fallback** | Works in windowed/borderless; GDI+ for exclusive fullscreen |
| AI Providers | **Gemini 2.5 Flash** (native) + **OpenAI-compatible** (Zen/Kilo) | Free tier + flexible provider system |
| Hotkeys | **Electron globalShortcut** | Native OS-level registration |
| TTS | **Web Speech API** (SpeechSynthesis) | Built into Chromium, no dependencies |
| Styling | **Tailwind CSS** | Fast UI development for overlay + settings |
| Build | **electron-builder** | Cross-platform packaging |
| Package Manager | **Bun** | Per environment instructions |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Hotkey Mgr  │  │  Screenshot  │  │  AI Provider     │  │
│  │  (global     │  │  Capture     │  │  Manager         │  │
│  │   shortcut)  │  │  (desktop    │  │  ┌─ Gemini      │  │
│  └──────┬───────┘  │   Capturer   │  │  ├─ OpenAI-Compat│  │
│         │          │   + GDI+)    │  │  └─ Ollama      │  │
│         │          └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│         ▼                 ▼                    ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IPC Bridge (contextBridge)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Tray Icon   │  │  Plugin Mgr  │  │  Config Store    │  │
│  │  (system     │  │  (bun-mem    │  │  (electron-store)│  │
│  │   tray)      │  │   reader)    │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                    IPC    │  ipcRenderer.invoke()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (React)                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Overlay     │  │  Settings    │  │  Chat History    │  │
│  │  (floating,  │  │  Window      │  │  (optional)      │  │
│  │   transparent│  │  (full UI)   │  │                  │  │
│  │   response)  │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
E:\Game\gaming-copilot\gaming-copilot\
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── electron-builder.yml
├── tailwind.config.js
├── postcss.config.js
├── .env.example                    # API keys template
│
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry, window management
│   │   ├── capture.ts              # Screenshot capture (desktopCapturer + GDI+)
│   │   ├── hotkey.ts               # Global hotkey registration
│   │   ├── ai-providers/           # AI vision provider implementations
│   │   │   ├── index.ts            # Provider manager + factory
│   │   │   ├── gemini.ts           # Google Gemini 2.5 Flash
│   │   │   ├── openai-compat.ts    # OpenAI-compatible (Zen, Kilo, etc.)
│   │   │   └── types.ts            # Provider interface + types
│   │   ├── ipc.ts                  # IPC handler registrations
│   │   ├── tray.ts                 # System tray icon + menu
│   │   ├── plugins.ts              # Plugin manager (bun-memreader sidecar)
│   │   ├── config.ts               # Config store (electron-store)
│   │   └── tts.ts                  # Text-to-speech (Web Speech API wrapper)
│   │
│   ├── preload/                    # Preload scripts (contextBridge)
│   │   └── index.ts                # Expose IPC methods to renderer
│   │
│   ├── renderer/                   # Frontend UI (React)
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx            # React entry
│   │   │   ├── App.tsx             # Root component
│   │   │   ├── components/
│   │   │   │   ├── Overlay.tsx     # Floating transparent overlay
│   │   │   │   ├── Settings.tsx    # Settings window
│   │   │   │   ├── ProviderConfig.tsx  # API key + provider selection
│   │   │   │   ├── HotkeyConfig.tsx    # Hotkey configuration
│   │   │   │   ├── PromptEditor.tsx    # System prompt editor
│   │   │   │   ├── OverlayStyle.tsx    # Overlay appearance settings
│   │   │   │   ├── TTSConfig.tsx       # TTS toggle + voice selection
│   │   │   │   └── ChatHistory.tsx     # Recent analyses
│   │   │   ├── hooks/
│   │   │   │   ├── useOverlay.ts
│   │   │   │   └── useSettings.ts
│   │   │   ├── services/
│   │   │   │   └── api.ts          # IPC wrapper for main process calls
│   │   │   └── styles/
│   │   │       └── globals.css     # Tailwind base
│   │   └── public/
│   │       └── icon.png
│   │
│   └── shared/                     # Shared types between main/renderer
│       ├── types.ts                # GameState, ProviderConfig, etc.
│       └── constants.ts            # Default hotkeys, ports, etc.
│
├── plugins/                        # Plugin manifests
│   └── bun-memreader/
│       └── manifest.json           # Plugin metadata + API schema
│
├── resources/                      # App icons, assets
│   └── icon.ico
│
└── test/                           # Tests
    ├── unit/
    │   ├── capture.test.ts
    │   ├── ai-providers.test.ts
    │   └── config.test.ts
    └── integration/
        └── screenshot-to-ai.test.ts
```

---

## 5. Implementation Phases

### Phase 1: Project Scaffolding (Day 1)
**Goal**: Working electron-vite skeleton with React

1. Initialize electron-vite project with React + TypeScript template
2. Configure Tailwind CSS
3. Set up Biome for linting/formatting
4. Create basic directory structure
5. Verify: `bun run dev` opens an Electron window with React rendering

### Phase 2: Screenshot Capture (Day 1-2)
**Goal**: Reliable screenshot capture from any game

1. **desktopCapturer integration**:
   - Use `desktopCapturer.getSources({ types: ['window', 'screen'] })`
   - Capture specific window by title or full primary screen
   - Return as PNG Buffer in memory (no disk writes)

2. **Windows GDI+ fallback** (for exclusive fullscreen games):
   - Implement via PowerShell child process or native FFI
   - `SetForegroundWindow` → `GetWindowRect` → `CopyFromScreen` → Buffer
   - Based on the user's existing PowerShell script

3. **Game window detection**:
   - Enumerate running processes via `tasklist` or WMI
   - Match by window title or process name
   - Allow manual window selection in settings

4. **IPC bridge**: Expose `captureScreenshot()` to renderer

### Phase 3: AI Provider System (Day 2-3)
**Goal**: Pluggable AI vision providers with unified interface

1. **Provider interface** (`types.ts`):
   ```typescript
   interface AIProvider {
     name: string;
     analyze(image: Buffer, prompt: string, context?: string): Promise<string>;
     isAvailable(): boolean;
     getRateLimit(): { rpm: number; rpd: number };
   }
   ```

2. **Gemini provider** (`gemini.ts`):
   - Use `@google/genai` SDK
   - Model: `gemini-2.5-flash` (free tier)
   - Send image as inlineData (base64)
   - Support grounding (web search) for up-to-date game info

3. **OpenAI-compatible provider** (`openai-compat.ts`):
   - Generic OpenAI chat completions API
   - Works with: OpenCode Zen, Kilo Gateway, OpenRouter, local Ollama
   - Configurable base URL + API key
   - Model: configurable (default: auto-detect)

4. **Provider manager** (`index.ts`):
   - Auto-detect available providers from config
   - Fallback chain: primary → secondary → tertiary
   - Rate limit tracking per provider
   - Response caching (optional)

### Phase 4: Floating Overlay UI (Day 3-4)
**Goal**: Transparent, always-on-top response display

1. **Electron window setup**:
   - Frameless, transparent background
   - Always on top (`alwaysOnTop: true`)
   - Ignore mouse events (click-through when not interacting)
   - Position: bottom-right corner, configurable

2. **Overlay component**:
   - Shows AI response text
   - Typing animation (optional)
   - Auto-dismiss after configurable duration (default: 8 seconds)
   - Manual dismiss via hotkey or click
   - Fade-in/fade-out animations

3. **Interaction modes**:
   - **Pass-through mode**: Mouse clicks go through to game
   - **Active mode**: Mouse events captured for scrolling/copying
   - Toggle via hotkey (e.g., Ctrl+Shift when overlay visible)

### Phase 5: Settings GUI (Day 4-5)
**Goal**: Full settings window with all configuration

1. **Settings window** (separate Electron BrowserWindow):
   - General: Hotkey, auto-start, minimize to tray
   - Providers: API keys, model selection, fallback order
   - Capture: Game selection, capture mode (window/fullscreen)
   - Overlay: Position, opacity, duration, font size, theme
   - TTS: Toggle, voice, speed, pitch
   - Plugins: Enable/disable bun-memreader sidecar
   - Advanced: Log level, cache settings

2. **Config persistence** (`electron-store`):
   - JSON config file in app data directory
   - Schema validation on load
   - Migration support for version upgrades

### Phase 6: TTS Integration (Day 5)
**Goal**: Optional text-to-speech for AI responses

1. **Web Speech API wrapper**:
   - `speechSynthesis.speak()` with configurable voice
   - Language: auto-detect from response or configurable
   - Speed, pitch, volume controls

2. **Integration with overlay**:
   - Speak response when overlay appears
   - Stop speaking when overlay dismissed
   - Toggle in settings (off by default)

### Phase 7: Plugin System (Day 5-6)
**Goal**: bun-memreader integration as optional sidecar

1. **Plugin manifest** (`plugins/bun-memreader/manifest.json`):
   ```json
   {
     "name": "bun-memreader",
     "version": "1.0.0",
     "description": "Dragon Crusade memory reader",
     "api": {
       "endpoint": "http://localhost:31337",
       "routes": {
         "state": "/api/state",
         "health": "/api/health"
       }
     },
     "contextTemplate": "Player {name} (Lv.{level}) at ({x}, {y}, {z}) | HP: {hp}, MP: {mp}, FP: {fp}"
   }
   ```

2. **Plugin manager** (`plugins.ts`):
   - Auto-start sidecar process if configured
   - Health check polling
   - Inject context into AI prompts
   - Graceful degradation if plugin unavailable

3. **Prompt augmentation**:
   - Base prompt: "Analyze this game screenshot..."
   - Plugin context: "Player data: HP=621, MP=508, Position=(7023, 100, 3409)"
   - Combined: Full context for AI analysis

### Phase 8: System Tray (Day 6)
**Goal**: Background operation with tray icon

1. **Tray icon**:
   - Custom icon in system tray
   - Right-click menu: Open Settings, Quit, Recent Analyses
   - Tooltip: Current status (connected/disconnected)
   - Badge indicator when analysis in progress

2. **Background mode**:
   - Close button minimizes to tray (configurable)
   - Auto-start with Windows (optional)
   - Single instance enforcement

### Phase 9: Polish & Packaging (Day 6-7)
**Goal**: Production-ready build

1. **Error handling**:
   - Graceful API failures (rate limits, network errors)
   - Screenshot capture failures (black screen, permission denied)
   - Plugin connection failures

2. **Logging**:
   - File logging for debugging
   - Log rotation
   - Verbose mode toggle

3. **Packaging**:
   - electron-builder config for Windows installer
   - Auto-update support (optional)
   - Code signing (optional)

---

## 6. Key Component Details

### 6.1 Screenshot Capture (`capture.ts`)

```typescript
// Primary method: Electron desktopCapturer
async function captureWindow(windowTitle?: string): Promise<Buffer> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  // Find specific window or primary screen
  const source = windowTitle
    ? sources.find(s => s.name.includes(windowTitle))
    : sources.find(s => s.display_id !== ''); // primary screen

  return source.thumbnail.toPNG();
}

// Fallback: Windows GDI+ (for exclusive fullscreen)
async function captureFullscreenGDI(): Promise<Buffer> {
  // Spawn PowerShell child process
  // Based on user's existing script
  // Returns PNG buffer
}
```

### 6.2 AI Provider Interface (`ai-providers/types.ts`)

```typescript
interface AIProvider {
  readonly name: string;
  readonly displayName: string;

  analyze(params: {
    image: Buffer;
    mimeType: 'image/png' | 'image/jpeg';
    systemPrompt: string;
    userMessage: string;
    context?: string;  // game-specific data from plugins
  }): Promise<AIResponse>;

  isConfigured(): boolean;
  getRateLimitInfo(): RateLimitInfo;
}

interface AIResponse {
  text: string;
  provider: string;
  model: string;
  tokens: { input: number; output: number };
  latencyMs: number;
  timestamp: number;
}
```

### 6.3 Overlay Component (`Overlay.tsx`)

```tsx
// Transparent, always-on-top overlay
function Overlay({ response, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (response) {
      setVisible(true);
      // Fade in
      setTimeout(() => setOpacity(1), 50);
      // Auto-dismiss after duration
      const timer = setTimeout(onDismiss, config.overlay.duration);
      return () => clearTimeout(timer);
    }
  }, [response]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 max-w-md p-4 bg-black/80
                 text-white rounded-lg backdrop-blur-sm
                 transition-opacity duration-300"
      style={{ opacity }}
    >
      <p className="text-sm">{response.text}</p>
      <button onClick={onDismiss} className="absolute top-2 right-2">✕</button>
    </div>
  );
}
```

### 6.4 Provider Manager (`ai-providers/index.ts`)

```typescript
class ProviderManager {
  private providers: AIProvider[] = [];
  private rateLimits: Map<string, RateLimitInfo> = new Map();

  constructor(config: AppConfig) {
    // Initialize configured providers
    if (config.gemini?.apiKey) {
      this.providers.push(new GeminiProvider(config.gemini));
    }
    if (config.openaiCompat?.apiKey) {
      this.providers.push(new OpenAICompatProvider(config.openaiCompat));
    }
  }

  async analyze(image: Buffer, prompt: string, context?: string): Promise<AIResponse> {
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      if (this.isRateLimited(provider.name)) continue;

      try {
        const response = await provider.analyze({
          image,
          mimeType: 'image/png',
          systemPrompt: this.getSystemPrompt(),
          userMessage: prompt,
          context,
        });
        this.trackRateLimit(provider.name);
        return response;
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        continue; // Try next provider
      }
    }
    throw new Error('All AI providers failed');
  }
}
```

---

## 7. Configuration Schema

```typescript
interface AppConfig {
  // General
  hotkey: string;                    // Default: 'CommandOrControl+Shift+G'
  autoStart: boolean;                // Default: false
  minimizeToTray: boolean;           // Default: true

  // Capture
  captureMode: 'window' | 'fullscreen' | 'region';
  targetWindow: string;              // Process name or window title
  captureQuality: number;            // 1-100, default: 85

  // Providers
  providers: {
    gemini?: {
      apiKey: string;
      model: string;                 // Default: 'gemini-2.5-flash'
      grounding: boolean;            // Web search, default: true
    };
    openaiCompat?: {
      baseUrl: string;               // e.g., 'https://api.opencode.ai/v1'
      apiKey: string;
      model: string;
    };
  };
  primaryProvider: string;           // 'gemini' | 'openaiCompat'
  fallbackProviders: string[];

  // Overlay
  overlay: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    duration: number;                // Auto-dismiss ms, default: 8000
    opacity: number;                 // 0-1, default: 0.9
    fontSize: number;                // px, default: 14
    theme: 'dark' | 'light' | 'game';
    clickThrough: boolean;           // Default: true
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
      enabled: boolean;
      port: number;                  // Default: 31337
      autoStart: boolean;
    };
  };

  // Prompts
  prompts: {
    system: string;                  // Default system prompt
    gameSpecific: Record<string, string>;  // Per-game prompts
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
| `capture:screenshot` | Renderer → Main | Request screenshot capture |
| `capture:screenshot-result` | Main → Renderer | Return screenshot buffer |
| `ai:analyze` | Renderer → Main | Send image to AI provider |
| `ai:analyze-result` | Main → Renderer | Return AI response |
| `config:get` | Renderer → Main | Read configuration |
| `config:set` | Renderer → Main | Update configuration |
| `hotkey:register` | Renderer → Main | Register global hotkey |
| `hotkey:unregister` | Renderer → Main | Unregister global hotkey |
| `tts:speak` | Renderer → Main | Request TTS playback |
| `tts:stop` | Renderer → Main | Stop TTS playback |
| `plugin:status` | Renderer → Main | Check plugin health |
| `overlay:show` | Main → Renderer | Show overlay with response |
| `overlay:hide` | Main → Renderer | Hide overlay |

---

## 10. Dependencies

### Production
```json
{
  "@google/genai": "^1.0.0",
  "electron-store": "^10.0.0",
  "sharp": "^0.33.0"
}
```

### Development
```json
{
  "electron": "^33.0.0",
  "electron-vite": "^3.0.0",
  "@biomejs/biome": "^2.4.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "tailwindcss": "^4.0.0",
  "typescript": "^5.6.0",
  "@types/react": "^18.3.0",
  "electron-builder": "^25.0.0"
}
```

---

## 11. Testing Strategy

1. **Unit tests**: Capture logic, provider interface, config validation
2. **Integration tests**: Screenshot → AI → Overlay pipeline
3. **Manual tests**: Run against actual games (Dragon Crusade, New World, etc.)
4. **Edge cases**: Game minimized, game in exclusive fullscreen, API rate limited, no API key configured

---

## 12. Open Questions

1. **OpenCode Zen / Kilo Gateway API format**: Need to confirm the exact API endpoint and authentication method. Are they standard OpenAI-compatible APIs?
2. **Overlay interaction**: Should users be able to type follow-up questions in the overlay, or is it strictly display-only?
3. **Screenshot region**: Should users be able to select a specific region of the screen (e.g., just the inventory panel)?
4. **Multiple monitors**: Which monitor to capture? Primary, secondary, or configurable?
5. **Image preprocessing**: Should we crop/resize screenshots before sending to AI (reduce token cost)?

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Exclusive fullscreen games show black screenshot | GDI+ fallback + user notification to switch to borderless windowed |
| Gemini free tier rate limits | Fallback to OpenAI-compatible provider + rate limit display in UI |
| API key security | Store in OS keychain (electron-store with encryption) or .env file |
| Game anti-cheat false positive | Screenshot capture is 100% external, no memory reading |
| Overlay blocks gameplay | Click-through mode + configurable position + quick dismiss |
