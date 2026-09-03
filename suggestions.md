# Feature Suggestions

## Overview

This document catalogs opportunities for improvement, new features, and optimizations in the Gaming Copilot project. The analysis covers architecture, UX, performance, security, maintainability, and completeness gaps identified by comparing the codebase against the PLAN.md roadmap and best practices.

## Completed Items

| ID | Category | Description | Commit |
|----|----------|-------------|--------|
| CRD-001 | Bug Fix | Added global type augmentation for `window.electronAPI` via `src/renderer/src/types/electron.d.ts` | `9ed6c01` |
| CRD-002 | Bug Fix | Fixed broken import path in `ai-providers/index.ts` (`../shared/types` → `../../shared/types`) | `9ed6c01` |
| FEAT-001 | Feature | Chat history persistence to disk via electron-store + "Recent Analyses" in chat UI | `e363b8b` |
| FEAT-002 | Bug Fix | Wired up Zen/Kilo API key persistence with onBlur save handlers, model inputs, and `OPENAI_COMPAT_PRESETS` | `9ed6c01` |
| FEAT-003 | Feature | Configurable hotkey — runtime re-registration via IPC handler + Settings UI | `c6b8603` |
| FEAT-004 | Bug Fix | Overlay now re-fetches config on each show for real-time settings updates | `d438520` |
| FEAT-005 | Feature | Auto-start with Windows via `app.setLoginItemSettings()` + IPC handler + toggle UI | `5016976` |
| FEAT-006 | Bug Fix | Wired up `captureQuality` config — JPEG compression for screenshots, dynamic MIME types | `13c7e93` |
| FEAT-007 | Performance | Resize screenshots to max 1024px width before sending to AI (configurable via `maxImageWidth`) | `5cdb103` |
| FEAT-008 | DevEx | Replaced all console.log in memreader.ts with structured logger module | `b8823a5` |
| FEAT-009 | Feature | Streaming AI responses (AsyncGenerator, typewriter effect, SSE parsing) | `fd7c2c4` |
| FEAT-010 | Feature | Windows system notifications on analysis complete via `Notification` API | `a79b195` |
| FEAT-011 | Feature | Custom OpenAI-compatible endpoint management (add/remove/test custom providers) | `23ed403` |
| FEAT-012 | Feature | Per-game system prompts UI with config wiring in hotkey/IPC handlers | `d2aeb33` |
| FEAT-013 | Feature | Capture quality slider in CaptureConfig settings | `a79b195` |
| FEAT-014 | UX | ChatHistory error handling with retry button and visual error styling | `622db0a` |
| FEAT-015 | Feature | Capture region preview thumbnail in Settings — "Preview" button captures a 256px thumbnail | `a45629b` |
| FEAT-016 | Performance | AI response caching with 60s TTL (SHA-1 keyed, clear cache button) | `4041919` |
| FEAT-017 | Feature | Added `maxImageWidth` config (default 1024) — `resizeImage()` now accepts configurable max width; slider in CaptureConfig | `a45629b` |
| FEAT-018 | Feature | Copy-to-clipboard button on assistant messages with visual confirmation | `622db0a` |
| FEAT-019 | Feature | Multiple monitor selection dropdown — `monitorIndex` config, `capture:get-screens` IPC, dropdown in CaptureConfig | `2ae8069` |
| FEAT-020 | Feature | Toggle hotkey registration at runtime via `hotkeyEnabled` config + IPC handler | `a45629b` |
| FEAT-021 | Feature | Custom CSS theme for overlay — background color, text color, border color, border radius, padding controls with live preview | `c1c4b03` |
| FEAT-022 | UX | Settings window is dark-themed by default; keyboard navigation works via tabbing | `e480f0c` |
| FEAT-023 | Feature | Export chat history as Markdown or JSON via download link | `a6ec947` |
| FEAT-025 | Feature | TTS voice preview button — plays sample text with current voice/rate/pitch/volume settings | `7e6f4d5` |
| FEAT-027 | Feature | OCR text extraction using Tesseract.js — on-screen text is extracted and passed as context to AI providers | `4cd006e` |
| FEAT-028 | Feature | Screen recording — captures keyframe burst over duration, composites into grid image for AI analysis | `a4a1afd` |
| FEAT-030 | Feature | Anonymous telemetry toggle — events for hotkey usage, analysis completion, provider status | `a6ec947` |
| FEAT-035 | DevEx | Added GitHub Actions CI workflow with format, lint, typecheck, build, and test steps | `d643341` |
| FEAT-039 | Security | Added exe name validation (`SAFE_EXE_PATTERN`) in `findProcessByExe` and `capture:check-game` IPC handler | `1de1d1b` |
| FEAT-040 | Infrastructure | `electron-store` configured with JSON schema validation for all config keys | `9ed6c01` |
| FEAT-041 | DevEx | File logging with daily rotation (max 7 files) in `%APPDATA%\gaming-copilot\logs\` | `e669f59` |
| FEAT-042 | DevEx | Region selector UI component (`RegionSelector.tsx`) for capture region selection | `a45629b` |
| FEAT-043 | Feature | Active provider switching UI — dropdown in ProviderConfig, wired to `config:set-active-provider` IPC handler | `3d7e069` |
| FEAT-044 | Security | API key encryption via `keytar` — keys stored in OS keyring, `useKeychain` config toggle, `SecureStorage` module | `3d7e069` |
| FEAT-045 | Security | Zod-based IPC input validation — `validateIPC()` helper, schemas in `src/main/schemas.ts`, 37 schema tests | `6ba2d7e` |
| FEAT-048 | DevEx | Memreader plugin unit tests — `src/main/plugins/__tests__/memreader.test.ts` covering config updates, start/stop lifecycle, and `parseState()` | `1de1d1b` |
| FEAT-049 | UX | Settings keyboard shortcuts — Ctrl+1 through Ctrl+6 tab navigation | `3d7e069` |
| FEAT-050 | UX | Light/dark mode toggle for Settings window — `theme` config field, toggle in GeneralConfig, CSS overrides | `3d7e069` |
| FEAT-051 | Security | Added `will-navigate` and `setWindowOpenHandler` blockers on overlay window to prevent protocol handler exploits | `3d7e069` |
| FEAT-052 | DevEx | Added explicit `contextIsolation: true` to both BrowserWindow configs for defense in depth | `3d7e069` |
| FEAT-053 | Feature | Capture mode selection UI — `captureMode` config field, IPC handler, `CaptureMode` type, `smartCapture()` dispatch | `3d7e069` |
| FEAT-054 | UX | ChatHistory keyboard shortcuts — Ctrl+Enter to send, Shift+? for help overlay, Escape dismisses overlay | `3d7e069` |
| FEAT-055 | DevEx | Extracted duplicate rate limiting logic into shared `RateLimiter` class (`rate-limiter.ts`, 5 unit tests) | `3d7e069` |
| FEAT-056 | Feature | Active provider badge in overlay — shows which AI provider generated the response (e.g., "via Gemini") as a label in the overlay, with `overlay:provider` IPC channel | `0b08778` |
| FEAT-057 | DevEx | Added `prebuild` script (format + lint + typecheck) chaining before electron-vite build | `e480f0c` |
| FEAT-058 | DevEx | Updated CI workflow to use `bunx` for biome/tsc/electron-vite invocation | `eda5484` |
| FEAT-046 | Feature | Auto-update via electron-updater — GitHub provider, `app:update` IPC handler, `app:get-version` handler, Settings UI with check/install buttons and live status, `onUpdateStatus` event listener | `6d06e0f` |
| FEAT-059 | UX | Dark mode auto-detect — `prefers-color-scheme` media query auto-switches Settings theme, 3-state toggle (Dark → Light → System), `theme` field updated to `"dark" | "light" | "system"` | `767ad99` |
| FEAT-060 | DevEx | TypeScript strictness audit — `noUnusedLocals`, `noUncheckedIndexedAccess`, `noUnusedParameters` enabled; all `any` types in test files eliminated | `48f0dd9` |
| FEAT-089 | Feature | Overlay custom CSS code editor — CSS textarea in OverlayStyle settings, `<style>` injection in Overlay component, `overlay:set-css` IPC handler, `.overlay-container/.overlay-text/.overlay-provider` class names | `83cd7d7` |
| FEAT-062 | Feature | Config import/export — export all settings as JSON for backup/migration, import with Zod schema validation, API keys redacted in export | `5623e94` |
FEAT-063 | Feature | Screenshot saving to disk with timestamped filenames — auto-save in hotkey capture flow, directory picker UI in CaptureConfig, `capture:pick-directory` and `capture:save-screenshot` IPC handlers with timestamped filenames — auto-save in hotkey capture flow, directory picker UI in CaptureConfig, `capture:pick-directory` and `capture:save-screenshot` IPC handlers | `5623e94` |

**Test suites (8 files, 139 tests total):**

| Module | File | Tests | Coverage |
|--------|------|-------|----------|
| Schemas | `src/main/__tests__/schemas.test.ts` | 41 | validateIPC, all input schemas, customCSS, configImportSchema |
| Capture | `src/main/capture/__tests__/capture.test.ts` | 30 | Smart capture, resize, crop, GDI, screen recording |
| Memreader | `src/main/plugins/__tests__/memreader.test.ts` | 23 | Config, start/stop lifecycle, parseState |
| ProviderManager | `src/main/ai-providers/__tests__/ProviderManager.test.ts` | 20 | Fallback chain, caching, rate limits, testProvider |
| Config | `src/main/__tests__/config.test.ts` | 16 | initConfig, defaults, chat store, getConfigPath, overlay CSS |
| Rate Limiter | `src/main/ai-providers/__tests__/rate-limiter.test.ts` | 5 | Increment, minute/day reset logic |
| Config Export | `src/main/__tests__/config-export.test.ts` | 4 | API key redaction (gemini + openaiCompat), field preservation, empty providers |
| Overlay CSS | `src/main/__tests__/overlay-css.test.ts` | 3 | customCSS default, setConfigValue round-trip, setPartialConfig |

**IPC Channels (in `src/main/index.ts`):**

Capture: `capture:get-screens`, `capture:screenshot`, `capture:record`, `capture:preview`, `capture:check-game`, `capture:set-region`

AI: `ai:analyze`, `ai:analyze-stream`, `ai:stream-chunk`, `ai:stream-done`, `ai:stream-error`, `ai:test-provider`, `ai:get-providers`, `ai:clear-cache`

Config: `config:get`, `config:set-game-exe`, `config:set-provider`, `config:remove-endpoint`, `config:set-active-provider`, `config:set-overlay`, `config:set-tts`, `config:set-prompts`, `config:set-auto-start`, `config:set-generic`, `config:set-telemetry`, `config:set-capture-mode`, `config:set-hotkey`, `config:set-hotkey-enabled`

Overlay: `overlay:show`, `overlay:hide`, `overlay:set-click-through`, `overlay:set-css`

Chat: `chat:save`, `chat:load`, `chat:clear`, `chat:export`

Plugins: `plugin:memreader:start`, `plugin:memreader:stop`, `plugin:memreader:state`, `plugin:memreader:connected`

Window: `window:open-settings`

Events (Main → Renderer): `overlay:data, overlay:stream-done, overlay:provider, overlay:set-css, capture:result, navigate:settings`

Telemetry: `trackEvent()` function for anonymous event tracking

---

## Open Opportunities

### High Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-046 | Feature | **Implement auto-update** — Add `electron-updater` and configure GitHub releases as the update provider. Add IPC handler for `app:update` and a UI indicator in Settings. The `publish` config in `electron-builder.yml` is already set to GitHub. | Medium | Medium |
| FEAT-047 | Security | **Add code signing for Windows** — Unsigned executables trigger Windows SmartScreen warnings. Add `CSC_LINK` and `CSC_KEY_PASSWORD` env vars to CI and electron-builder config. | High | Medium |

### Medium Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-064 | Feature | Visual hotkey picker — Replace text-input hotkey binding with a visual key combination recorder that captures key events. | Low | Low |
| FEAT-065 | Feature | Overlay text selection — Allow selecting and copying text from the overlay for follow-up questions or reference. | Low | Low |
| FEAT-066 | Feature | Overlay markdown rendering — Render AI responses as markdown (bold, lists, code blocks) in the overlay for better readability. | Medium | Low |
| FEAT-067 | UX | Overlay pin/freeze — Add a toggle to prevent the overlay from auto-dismissing, useful for reading longer responses. | Low | Low |
| FEAT-068 | UX | Debug mode toggle — Add a UI toggle in Settings to enable verbose file logging (equivalent to `DEBUG` env var) without restarting the app. | Low | Low |
| FEAT-069 | Feature | Clickable notifications — Make system notifications clickable to open the Settings window or show the last chat response. | Low | Low |
| FEAT-070 | Feature | Config schema versioning — Add a `version` field to config and implement migration logic for future upgrades. | Medium | Medium |
| FEAT-071 | Feature | AI provider usage statistics — Track and display token usage and estimated costs per provider in the Settings UI. | Medium | Medium |
| FEAT-072 | UX | App icon badge — Show a badge count on the app icon for unread analyses or pending responses. | Low | Low |
| FEAT-073 | UX | Settings window always on top — Toggle for keeping the Settings window always on top of other windows. | Low | Low |

### Lower Priority — Nice-to-Have

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-074 | Feature | Overlay resize — Allow resizing the overlay window to accommodate longer responses. | Low | Low |
| FEAT-075 | UX | Overlay scroll for long responses — Add vertical scrolling in the overlay for responses that exceed the window size. | Medium | Low |
| FEAT-076 | Feature | Capture before/after comparison — Compare two screenshots side by side in the ChatHistory view. | Low | Low |
| FEAT-077 | Feature | Tray tooltip status — Show active provider name and last capture time in the system tray tooltip. | Low | Low |
| FEAT-078 | Feature | Region selection aspect ratio lock — Maintain a fixed aspect ratio (e.g., 16:9) while selecting a capture region. | Low | Low |
| FEAT-079 | Feature | Per-monitor overlay positioning — Save overlay position independently for each monitor. | Low | Medium |
| FEAT-080 | Feature | Capture region presets — Save named capture regions for different games or scenarios. | Medium | Medium |
| FEAT-081 | Feature | Batch capture mode — Capture multiple regions sequentially and send them as a combined analysis request. | Low | Medium |
| FEAT-082 | UX | Overlay fade animation customization — Adjustable fade-in/fade-out durations in the Overlay settings. | Low | Low |
| FEAT-083 | Feature | Streaming cancellation — Cancel an in-progress AI stream with the Escape key. | Low | Low |
| FEAT-084 | Feature | System-wide overlay toggle hotkey — A dedicated hotkey to show/hide the overlay independent of capture. | Low | Low |
| FEAT-085 | Feature | Custom font selection for overlay — Choose a custom font family for overlay text. | Medium | Low |
| FEAT-086 | Feature | Multiple OCR language auto-detection — Auto-detect the game's language for more accurate OCR. | Low | Medium |
| FEAT-087 | Feature | Memreader auto-detect — Auto-detect if bun-memreader is already running on the configured port. | Low | Low |
| FEAT-088 | Platform | macOS and Linux support — The app currently uses Windows-specific APIs (GDI+, PowerShell, keytar Windows Credential Manager). Investigate cross-platform capture alternatives. | High | High |

---

## Implementation Roadmap

### Completed (Week 1-5)
All Week 1–5 items from the original roadmap are complete:
- FEAT-001 through FEAT-020 (bug fixes, UX, performance, features)
- FEAT-021 through FEAT-028 (advanced features: custom theme, chat export, OCR, screen recording)
- FEAT-030 (telemetry), FEAT-035 (CI), FEAT-039 (command injection fix)

### Recently Completed (Week 6-8)
- FEAT-051 — Overlay navigation security (will-navigate + setWindowOpenHandler blockers)
- FEAT-052 — Explicit contextIsolation: true on both BrowserWindow configs
- FEAT-043 — Active provider switching UI
- FEAT-053 — Capture mode selection UI
- FEAT-049 — Settings keyboard shortcuts (Ctrl+1–6)
- FEAT-044 — API key encryption via keytar (OS keyring, useKeychain toggle)
- FEAT-050 — Light/dark mode toggle for Settings window
- FEAT-054 — ChatHistory keyboard shortcuts (Ctrl+Enter, Shift+? help, Escape dismiss)
- FEAT-045 — Zod-based IPC input validation (validateIPC helper, 37 schema tests)
- FEAT-048 — Memreader plugin unit tests (23 tests)
- FEAT-055 — Extracted RateLimiter shared class (5 unit tests)
- FEAT-056 — Active provider badge in overlay (overlay:provider IPC channel)
- FEAT-057 — Added prebuild script (format + lint + typecheck before build)
- FEAT-058 — CI workflow updated to use bunx for tool invocation

### Current Focus (Week 9)
1. FEAT-046 — Auto-update (electron-updater integration)
2. FEAT-047 — Code signing (Windows)
3. FEAT-060 — TypeScript strictness audit
4. FEAT-059 — Dark mode auto-detect

### Future (Week 10+)
1. Remaining technical debt (TECH-005, TECH-006, TECH-007, TECH-008)
2. FEAT-061 through FEAT-088 (new suggestions from code review)

---

## Technical Debt

| ID | Description | Location | Effort |
|----|-------------|----------|--------|
| TECH-004 | **Redundant early return in memreader start()** — Investigated: NOT redundant. The IPC caller (`plugin:memreader:start`) calls `start()` without a pre-check, and the guard prevents double-spawn. Safe as-is. | `src/main/plugins/memreader.ts` | N/A |
| TECH-005 | **Memreader polling interval not cleared on port change** — If the port changes while the plugin is running, `updateConfig()` restarts polling, but the old `pollTimer` reference is retained until `stopPolling()` is called. This is handled but could be cleaner. | `src/main/plugins/memreader.ts` `updateConfig()` | Low |
| TECH-006 | **`config:set-generic` IPC handler uses `hotkeySchema` for validation** — The `validateIPC` call uses `hotkeySchema` (a string schema) to validate the key, but this should accept any valid config key, not just hotkey strings. Consider using a more permissive schema or a dedicated config key schema. | `src/main/index.ts` `config:set-generic` handler | Low |
| TECH-007 | **Duplicate `config:set-generic` listing in PLAN.md IPC table** — Listed twice in Section 9 of PLAN.md. | `PLAN.md` Section 9 | Trivial |
| TECH-008 | **`getScreens` IPC return type in preload incomplete** — Returns `{ index, name, primary }` but the main process also returns `bounds` and `workArea` which are omitted from the preload `ElectronAPI` interface. | `src/preload/index.ts` | Trivial |

---

_Generated from codebase analysis. Updated: 2026-09-03_




