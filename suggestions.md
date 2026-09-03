# Feature Suggestions

## Overview

This document catalogs opportunities for improvement, new features, and optimizations in the Gaming Copilot project. The analysis covers architecture, UX, performance, security, maintainability, and completeness gaps identified by comparing the codebase against the PLAN.md roadmap and best practices.

## Completed Items

| ID | Category | Description | PR |
|----|----------|-------------|-----|
| CRD-001 | Bug Fix | Added global type augmentation for `window.electronAPI` via `src/renderer/src/types/electron.d.ts` | `#1` |
| CRD-002 | Bug Fix | Fixed broken import path in `ai-providers/index.ts` (`../shared/types` → `../../shared/types`) | `#1` |
| FEAT-002 | Bug Fix | Wired up Zen/Kilo API key persistence with onBlur save handlers, model inputs, and `OPENAI_COMPAT_PRESETS` | `#1` |
| FEAT-005 | Feature | Implemented auto-start with Windows via `app.setLoginItemSettings()` + IPC handler + toggle UI | `#5` |
| FEAT-006 | Bug Fix | Wired up `captureQuality` config — JPEG compression for screenshots, dynamic MIME types | `#4` |
| FEAT-035 | DevEx | Added GitHub Actions CI workflow with format, lint, typecheck, build, and test steps | `#2` |
| FEAT-039 | Security | Added exe name validation (`SAFE_EXE_PATTERN`) in `findProcessByExe` and `capture:check-game` IPC handler | `#4` |
| FEAT-007 | Performance | Resize screenshots to max 1024px width before sending to AI | `#4` |
| TECH-008 | Refactor | Fixed `Overlay.tsx` to read `duration`, `position`, `opacity`, `fontSize` from config | `#3` |
| FEAT-003 | Feature | Configurable hotkey (runtime re-registration via IPC) | `#8` |
| FEAT-009 | Feature | Streaming AI responses (AsyncGenerator, typewriter effect, SSE parsing) | `#8` |
| FEAT-016 | Performance | AI response caching with 60s TTL (SHA-1 keyed, clear cache button) | `#10` |
| FEAT-024 | Feature | Overlay click-through toggle UI + IPC handler | `#8` |
| FEAT-011 | Feature | Custom OpenAI-compatible endpoint management (add/remove/test) | `#12` |
| FEAT-012 | Feature | Per-game system prompts UI with config wiring in hotkey/IPC handlers | `#13` |
| FEAT-017 | Feature | Added `maxImageWidth` config (default 1024) — `resizeImage()` now accepts configurable max width; slider in CaptureConfig | `#15` |
| FEAT-018 | Feature | Copy-to-clipboard button on assistant messages with visual confirmation | `#14` |
| FEAT-010 | Feature | Windows system notifications on analysis complete via `Notification` API | `#14` |
| FEAT-013 | Feature | Capture quality slider in CaptureConfig settings | `#14` |
| FEAT-014 | UX | ChatHistory error handling with retry button and visual error styling | `#15` |
| FEAT-015 | Feature | Capture region preview thumbnail in Settings — "Preview" button captures a 256px thumbnail | `#15` |
| FEAT-020 | Feature | Toggle hotkey registration at runtime via `hotkeyEnabled` config + IPC handler | `#15` |
| FEAT-004 | Bug Fix | Overlay now re-fetches config on each show for real-time settings updates | `#16` |
| FEAT-008 | DevEx | Replaced all console.log in memreader.ts with structured logger module | `#15` |
| FEAT-027 | Feature | OCR text extraction using Tesseract.js — on-screen text is extracted and passed as context to AI providers | `#16` |
| FEAT-019 | Feature | Multiple monitor selection dropdown — `monitorIndex` config, `capture:get-screens` IPC, dropdown in CaptureConfig | `#17` |

---

## Critical Development Issues

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| CRD-001 | Bug Fix | **Missing global type augmentation for `window.electronAPI`** — The `ElectronAPI` interface is defined in `src/preload/index.ts` but is never merged into the global `Window` type. The `tsconfig.web.json` does not include the preload directory, and there is no `global.d.ts` file. This causes TypeScript errors (`Property 'electronAPI' does not exist on type 'Window'`) across all renderer components that call `window.electronAPI.*`. | High | Low |
| CRD-002 | Bug Fix | **Broken import path in `ai-providers/index.ts`** — Line 1 imports `from "../shared/types"` but the file is at `src/main/ai-providers/index.ts`, so this resolves to `src/main/shared/types` which doesn't exist. The correct path is `../../shared/types`. | High | Low |
| CRD-003 | Refactor | **Duplicate `AIResponse` type** — `AIResponse` is defined in both `src/shared/types.ts` (with `ChatMessage` using `provider?` and `model?`) and `src/main/ai-providers/types.ts` (as a standalone interface). These should be consolidated to avoid divergence. | Medium | Low |

### CRD-001 Fix
Create `src/renderer/src/types/electron.d.ts`:
```typescript
import type { ElectronAPI } from "../../../preload/index";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```
Then add `src/renderer/src/types/**/*.d.ts` to the `include` array in `tsconfig.web.json`.

> **Security note**: Ensure the type augmentation is restricted to the renderer project scope. Do not expose arbitrary IPC channels without validation at the main process boundary.

### CRD-002 Fix
Change line 1 of `src/main/ai-providers/index.ts`:
```typescript
// Before (broken):
import type { AppConfig } from "../shared/types";
// After:
import type { AppConfig } from "../../shared/types";
```

---

## High Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-001 | Bug Fix | **Persist ChatHistory messages to disk** — Messages are stored only in React component state and are lost on every reload. Add persistence via IPC → electron-store and a "Recent Analyses" view in settings. | High | Medium |
| FEAT-002 | Bug Fix | **Save Zen/Kilo API keys in ProviderConfig** — The `zenKey` and `kiloKey` state variables exist but have no "Save" button and are never persisted. The keys are only used for testing, never stored. | High | Low |
| FEAT-003 | Feature | **Wire up configurable hotkey** — `appConfig.hotkey` and `DEFAULT_HOTKEY` exist in config, but the hotkey is hardcoded as `CommandOrControl+Shift+G` in `registerHotkey()`. Register the hotkey from config and expose an IPC handler to change it at runtime. | High | Medium |
| FEAT-004 | Bug Fix | **Overlay ignores config values** — The `Overlay.tsx` component hardcodes an 8000ms auto-dismiss timer instead of reading `appConfig.overlay.duration`, and does not apply position/opacity/fontSize settings. Read config on mount and apply overlay styling dynamically. | High | Medium |
| FEAT-005 | Bug Fix | **Wire up auto-start with Windows** — `autoStart` exists in `AppConfig` and the electron-store schema, but there is no IPC handler, no `app.setLoginItemSettings()` call, and no UI toggle. Implement auto-start via the Electron login item API and add a toggle in settings. | High | Medium |
| FEAT-006 | Security | **Encrypt or migrate API keys to OS keychain** — API keys for Gemini, Zen, and Kilo are stored in plaintext JSON via `electron-store`. For a production product, use `keytar` or `electron-store`'s encryption capability to protect credentials at rest. | High | Medium |
| FEAT-007 | Performance | **Resize/compress screenshots before sending to AI** — Full-resolution screenshots (up to 1920×1080) are sent directly to AI providers, dramatically increasing token cost and latency. Down-scale images to a max width of 1024px (or configurable) before encoding to base64. | High | Medium |
| FEAT-008 | Infrastructure | **Add logging integration throughout main process** — The `logger` module is imported in `index.ts` and `config.ts` but `console.error`/`console.log` is used directly in `memreader.ts` and `ai-providers/index.ts`. Replace all direct console calls with the `logger` module. | High | Low |

### Detailed Notes

**FEAT-001 — ChatHistory persistence**
- File: `src/renderer/src/components/ChatHistory.tsx`
- Current state: Messages exist only in `useState<ChatMessage[]>`; no IPC call to save or load history.
- Suggested: Add IPC handlers `chat:save-message` and `chat:get-history` in `src/main/index.ts`. Store messages in electron-store or a dedicated JSON file. Add a "Recent Analyses" tab in Settings to browse history.

**FEAT-002 — ProviderConfig key persistence**
- File: `src/renderer/src/components/ProviderConfig.tsx`
- Current state: `zenKey` and `kiloKey` are `useState` fields with `onChange` handlers but no `onBlur` or "Save" button. They're passed to `handleTest()` but never written to config.
- Suggested: Add `onBlur` handlers or a "Save" button that calls `setProvider("zen", { apiKey: zenKey, ... })` and `setProvider("kilo", { apiKey: kiloKey, ... })`.

**FEAT-003 — Configurable hotkey**
- File: `src/main/index.ts` — `registerHotkey()` line 106
- Current state: `globalShortcut.register("CommandOrControl+Shift+G", ...)` is hardcoded.
- Suggested: Use `appConfig.hotkey`. Add IPC handler `config:set-hotkey` that unregisters the old hotkey and registers the new one, then persists to config. Expose a UI in Settings to rebind the hotkey.

**FEAT-007 — Image preprocessing**
- Files: `src/main/capture/index.ts`, `src/main/ai-providers/gemini.ts`, `src/main/ai-providers/openai-compat.ts`
- Current state: Full-resolution PNG buffers are base64-encoded and sent directly to AI.
- Suggested: Add a resize step using sharp or canvas that limits image dimensions to ≤1024px width while maintaining aspect ratio. Apply before encoding to base64 in `smartCapture()` or in the provider's `analyze()` method.

---

## Medium Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-009 | Feature | **Add streaming AI responses** — Both Gemini and OpenAI-compatible providers support streaming. Implement streamed responses so overlay text appears incrementally (typewriter effect) instead of waiting for full response. | Medium | Medium |
| FEAT-010 | Feature | **Add Windows system notifications** — Use `electron.Notification` to show non-blocking notifications when analysis completes (e.g., "Analysis ready: <summary>"). Useful when the user is alt-tabbed out of the game. | Medium | Low |
| FEAT-011 | Feature | **Allow custom OpenAI-compatible endpoints** — Currently Zen and Kilo are hardcoded presets. Add a "Custom Provider" section in ProviderConfig that lets users add arbitrary OpenAI-compatible endpoints with their own base URL, model name, and key. | Medium | Medium |
| FEAT-012 | Feature | **Per-game system prompts** — `AppConfig.prompts.gameSpecific` exists as a `Record<string, string>` but there's no UI to configure per-game prompts, and the system prompt is never conditionally selected. Add a UI to map game exe names to custom prompts and use the appropriate prompt in the hotkey handler. | Medium | Medium |
| FEAT-013 | Feature | **Image preprocessing settings** — Add settings for screenshot resolution cap (e.g., 512/1024/1920), JPEG quality, and image format (PNG vs JPEG). JPEG at lower quality significantly reduces token cost for vision models. | Medium | Medium |
| FEAT-014 | UX | **Improve ChatHistory error handling** — When analysis fails, the error message is appended as an assistant message. Improve UX with retry button, visual error styling, and the ability to resubmit with a different provider. | Medium | Medium |
| FEAT-015 | Feature | **Add capture region preview thumbnail** — In Settings → Capture, show a small thumbnail preview of the currently selected capture region overlaid on a recent screenshot, so users can verify their region selection visually. | Medium | Medium |
| FEAT-016 | Performance | **Implement AI response caching** — Cache AI responses keyed by screenshot hash. If the same screen region is captured again within a short window (e.g., 30 seconds), return the cached response instead of hitting the API. This reduces cost and improves speed for rapid re-captures. | Medium | Medium |
| FEAT-017 | Feature | **Add capture quality setting usage** — `captureQuality` (1-100) is in `AppConfig` and the schema with a default of 85, but it's never read or applied anywhere. Use it to control JPEG quality in the image preprocessing pipeline. | Medium | Low |
| FEAT-018 | Feature | **Add "copy to clipboard" for AI responses** — In the ChatHistory and Overlay, add a button to copy the AI response text to the clipboard. Useful for users who want to paste tips into game chat or a notes app. | Medium | Low |
| FEAT-019 | Feature | **Multiple monitor selection** — Currently `captureFullScreen()` always captures `sources[0]` (primary screen). Add a setting to select which monitor to capture, and enumerate all available displays in the Settings → Capture tab. | Medium | Medium |
| FEAT-020 | Feature | **Toggle hotkey registration** — Add a setting to enable/disable the global hotkey at runtime without restarting the app. Currently the hotkey is registered once on startup and unregistered on quit. | Medium | Low |

### Detailed Notes

**FEAT-009 — Streaming responses**
- Files: `src/main/ai-providers/types.ts`, `src/main/ai-providers/gemini.ts`, `src/main/ai-providers/openai-compat.ts`, `src/renderer/src/components/ChatHistory.tsx`, `src/renderer/src/components/Overlay.tsx`
- The `AIProvider.analyze()` method returns `Promise<AIResponse>`. Add a `streamAnalyze()` method that returns an `AsyncGenerator<string>` for incremental text chunks. The IPC handler `ai:analyze` would need to be converted to use `invoke` with a streaming-compatible pattern (e.g., send chunks via `capture:result`-style push events).

**FEAT-011 — Custom OpenAI-compatible endpoints**
- File: `src/renderer/src/components/ProviderConfig.tsx`
- Currently Zen and Kilo are hardcoded with fixed base URLs. Add a "+ Add Custom Provider" button that renders input fields for name, base URL, API key, and model. On save, push the endpoint to `appConfig.providers.openaiCompat.endpoints`.

**FEAT-016 — Response caching**
- File: `src/main/ai-providers/index.ts` — `ProviderManager.analyze()`
- Add a `Map<string, AIResponse>` cache keyed by a hash of the base64 image. Store with a TTL (e.g., 60 seconds). Before calling any provider, check the cache. Add a config setting to enable/disable caching.

---

## Low Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-021 | Feature | **Add custom CSS theme support for overlay** — Beyond the 3 preset themes (dark/light/game), allow users to customize overlay background color, text color, border radius, and padding via a color picker UI. | Low | Medium |
| FEAT-022 | Feature | **Add keyboard shortcuts in Settings UI** — Navigate between tabs with `Ctrl+1` through `Ctrl+5`. Add focus management and form keyboard navigation. | Low | Low |
| FEAT-023 | Feature | **Add "export chat history" feature** — Export all chat messages to a Markdown or JSON file. Useful for users who want to save analysis notes. | Low | Low |
| FEAT-024 | Feature | **Add overlay click-through toggle UI** — `clickThrough` exists in config but there's no UI control. Add a toggle in OverlayStyle settings. When enabled, mouse events pass through to the game; when disabled, users can interact with the overlay. | Low | Low |
| FEAT-025 | Feature | **Add TTS voice preview** — In TTSConfig, add a "Preview" button that speaks a sample sentence using the currently selected voice/rate/pitch settings. | Low | Low |
| FEAT-026 | Feature | **Add dark/light mode toggle for Settings window** — Currently the app is dark-themed. Add a toggle to switch to a light theme for the settings window. | Low | Low |
| FEAT-027 | Feature | **Add OCR for extracted text** — After capturing a screenshot, run OCR (e.g., via Tesseract.js or a local provider) to extract on-screen text. Include the extracted text as additional context in the AI prompt. | Low | High |
| FEAT-028 | Feature | **Add screen recording capability** — Allow users to record a short video clip (e.g., 10 seconds) of gameplay and send it to AI for analysis. More useful than still images for action sequences. | Low | High |
| FEAT-029 | DevEx | **Add screenshot capture mode selection** — Allow users to choose between "window only" (desktopCapturer by exe name), "fullscreen" (entire primary monitor), "GDI+ fallback" (PowerShell), or "auto" (try all in order). Currently the chain is hardcoded in `smartCapture()`. | Low | Medium |
| FEAT-030 | DevEx | **Add telemetry toggle** — Add a setting to allow users to opt in/out of anonymous usage analytics (feature usage, capture frequency, provider success rates). Respect user privacy. | Low | Medium |

---

## Testing & Quality

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-031 | Testing | **Add unit tests for capture logic** — `src/main/capture/index.ts` has no tests. Create test suite with vitest covering: `cropBuffer()`, `smartCapture()` fallback chain logic, region bounding box validation. Mock `desktopCapturer` and `execSync`. | Medium | Medium |
| FEAT-032 | Testing | **Add unit tests for ProviderManager** — `src/main/ai-providers/index.ts` has no tests. Test the fallback chain, rate limit checking, and error propagation. Mock provider implementations. | Medium | Medium |
| FEAT-033 | Testing | **Add unit tests for config module** — `src/main/config.ts` has no tests. Test `initConfig()`, `setConfigValue()`, `setPartialConfig()`, and `getDefaultConfig()` with a mocked `electron-store`. | Medium | Low |
| FEAT-034 | Testing | **Add unit tests for MemreaderPlugin** — `src/main/plugins/memreader.ts` has no tests. Test config updates, start/stop lifecycle, and `parseState()` with various data shapes. | Medium | Medium |
| FEAT-035 | DevEx | **Add ESLint/Prettier config consistency check** — Biome is configured but there's no CI check. Add a GitHub Actions workflow that runs `bun run build` (format + lint + typecheck + build) on every PR. | Medium | Low |
| FEAT-036 | DevEx | **Add TypeScript strict mode** — Check `tsconfig.json` files; ensure `strict: true` is enabled and consider enabling `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`. | Low | Low |

### Detailed Notes

**FEAT-031 — Capture tests**
- File: `test/capture.test.ts` (new file)
- Use vitest with mocks for `desktopCapturer.getSources` and `child_process.execSync`.
- Test cases: valid crop returns correctly sized buffer; invalid region falls back to original buffer; `smartCapture` tries window → GDI → fullscreen in correct order.

**FEAT-036 — TypeScript strictness**
- File: `tsconfig.node.json`, `tsconfig.web.json`
- Verify strict mode is enabled and consider adding `noUncheckedIndexedAccess` for array safety.

---

## Security & Production Hardening

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-037 | Security | **Add code signing for Windows** — Unsigned executables will trigger Windows SmartScreen warnings. Add `CSC_LINK` and `CSC_KEY_PASSWORD` to the build config and CI. | High | Medium |
| FEAT-038 | Feature | **Implement auto-update** — Add `electron-updater` and configure GitHub releases as the update provider. Add IPC handler for `app:update` and a UI indicator in Settings showing current version and update status. | Medium | Medium |
| FEAT-039 | Security | **Validate game exe name input** — The `capture:check-game` IPC handler passes user input directly to `tasklist` in `findProcessByExe()`. Add input validation/sanitization to prevent command injection via the exe name field. | High | Low |
| FEAT-040 | Security | **Add IPC input validation** — Several IPC handlers accept untyped `Record<string, unknown>` payloads (e.g., `config:set-provider`). Add proper type validation using Zod or manual type guards before writing to config store. | Medium | Medium |
| FEAT-041 | Security | **Restrict overlay window navigation** | `overlayWindow.loadURL()` accepts an external URL — add `will-navigate` and `new-window` event handlers that block navigation to prevent potential protocol handler exploits. | Medium | Low |
| FEAT-042 | DevEx | **Add `contextIsolation: true` to BrowserWindow** — The current config sets `sandbox: false` and does not explicitly set `contextIsolation`. While `contextBridge` is used (implying isolation is on), explicitly set `contextIsolation: true` for clarity and defense in depth. | Medium | Low |

### Detailed Notes

**FEAT-039 — Command injection in findProcessByExe**
- File: `src/main/capture/win32.ts` — `findProcessByExe()` line 16
- Current: `execSync('tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH')` — the `name` parameter comes from user input.
- Suggested: Validate that `name` matches a safe pattern like `/^[\w.-]+$/` and throw/return null if invalid.

---

## Feature Matrix

### Existing Features (implemented)

| Feature | Status | Files |
|---------|--------|-------|
| Screenshot capture (desktopCapturer → GDI+ → fullscreen) | Done | `src/main/capture/` |
| AI vision analysis (Gemini, Zen, Kilo) | Done | `src/main/ai-providers/` |
| Floating overlay with auto-dismiss | Done (partial) | `src/renderer/src/components/Overlay.tsx` |
| Settings GUI (5 tabs) | Done | `src/renderer/src/components/Settings.tsx` |
| TTS (Web Speech API) | Done | `src/renderer/src/tts.ts` |
| System tray | Done | `src/main/index.ts` |
| Region selector | Done | `src/renderer/src/components/RegionSelector.tsx` |
| bun-memreader plugin | Done | `src/main/plugins/memreader.ts` |
| Chat history (in-memory only) | Partial | `src/renderer/src/components/ChatHistory.tsx` |
| Config persistence | Partial | `src/main/config.ts` (wired but some settings not saved from UI) |
| Logger with file rotation | Done | `src/main/logger/index.ts` (module exists but underutilized) |

### Missing Features (from PLAN.md and analysis)

| Feature | Priority |
|---------|----------|
| Config persistence fully wired (save on all settings) | High |
| Auto-start with Windows | High |
| Chat history persistence | High |
| Auto-update | Medium |
| Unit/integration tests | Medium |
| Code signing | High |
| Streaming AI responses | Medium |
| Custom OpenAI-compatible endpoints | Medium |
| Windows system notifications | Medium |
| Per-game system prompts | Medium |
| Image preprocessing/resizing | High |
| OCR text extraction | Low |
| Screen recording | Low |
| Telemetry/analytics | Low |

---

## Technical Debt

| ID | Description | Location | Effort |
|----|-------------|----------|--------|
| TECH-001 | **Hardcoded dimensions in GDI+ capture** — `captureWithGDI()` returns `width: 1920, height: 1080` as hardcoded values instead of reading actual image dimensions from the buffer. | `src/main/capture/index.ts` line 186-187 | Low |
| TECH-002 | **Duplicate RateLimitInfo implementation** — Both `GeminiProvider` and `OpenAICompatProvider` implement identical `resetCountersIfNeeded()` and rate limit tracking logic. Extract to a shared base class or mixin. | `src/main/ai-providers/gemini.ts`, `src/main/ai-providers/openai-compat.ts` | Low |
| TECH-003 | **Console.log usage in plugins** — `MemreaderPlugin` uses `console.log`/`console.error` instead of the `logger` module. | `src/main/plugins/memreader.ts` | Low |
| TECH-004 | **Unreachable code in memreader start()** — If `this.process` is already set, `start()` returns early. But `start()` is called from `updateConfig()` which checks `!this.process` first, making the early return redundant. | `src/main/plugins/memreader.ts` lines 48-49 | Low |
| TECH-005 | **No cleanup for memreader polling on config change** — If the port changes while the plugin is running, the old polling interval continues hitting the old port. | `src/main/plugins/memreader.ts` `updateConfig()` | Low |
| TECH-006 | **Unused `captureQuality` config** — Defined in `AppConfig`, schema, and defaults but never read. | `src/shared/types.ts`, `src/main/config.ts` | Low |
| TECH-007 | **Missing `activeProvider` IPC handler** — `ProviderManager.setActiveProvider()` exists but is never called from IPC. Users cannot switch active provider at runtime. | `src/main/index.ts` | Low |
| TECH-008 | **Overlay timeout mismatch** — `Overlay.tsx` hardcodes 8000ms, but `DEFAULT_OVERLAY.duration` is 8000ms too. If a user changes the overlay duration in Settings, the change won't affect the overlay. | `src/renderer/src/components/Overlay.tsx` line 58 | Low |

---

## Implementation Roadmap Suggestion

### Week 1: Bug Fixes & Stability
1. FEAT-002 (Zen/Kilo key persistence)
2. FEAT-006 (Config persistence wiring for all settings)
3. FEAT-008 (Logger integration)
4. FEAT-039 (Command injection fix)
5. FEAT-035 (CI workflow)

### Week 2: UX Improvements
1. FEAT-003 (Configurable hotkey)
2. FEAT-004 (Overlay config wiring)
3. FEAT-005 (Auto-start with Windows)
4. FEAT-018 (Copy to clipboard)
5. FEAT-020 (Toggle hotkey registration)

### Week 3: Performance & Features
1. FEAT-007 (Image preprocessing)
2. FEAT-017 (Capture quality usage)
3. FEAT-016 (AI response caching)
4. FEAT-024 (Overlay click-through toggle UI)
5. FEAT-025 (TTS voice preview)

### Week 4: Advanced Features
1. FEAT-009 (Streaming responses)
2. FEAT-010 (Windows notifications)
3. FEAT-011 (Custom OpenAI-compatible endpoints)
4. FEAT-012 (Per-game system prompts)
5. FEAT-019 (Multiple monitor selection)

### Week 5: Testing & Hardening
1. FEAT-031–034 (Unit tests)
2. FEAT-037 (Code signing)
3. FEAT-038 (Auto-update)
4. FEAT-039–042 (Security hardening)
5. TECH-001–008 (Technical debt cleanup)
