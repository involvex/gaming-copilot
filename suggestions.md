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
| FEAT-048 | DevEx | Memreader plugin unit tests — `src/main/plugins/__tests__/memreader.test.ts` covering config updates, start/stop lifecycle, and `parseState()` with various data shapes | `1de1d1b` |
| FEAT-051 | Security | Added `will-navigate` and `setWindowOpenHandler` blockers on overlay window to prevent protocol handler exploits | `3d7e069` |
| FEAT-052 | DevEx | Added explicit `contextIsolation: true` to both BrowserWindow configs for defense in depth | `3d7e069` |
| FEAT-043 | Feature | Active provider switching UI — dropdown in ProviderConfig, wired to `config:set-active-provider` IPC handler | `3d7e069` |
| FEAT-053 | Feature | Capture mode selection UI — `captureMode` config field, IPC handler, `CaptureMode` type, `smartCapture()` dispatch | `3d7e069` |
| FEAT-049 | UX | Settings keyboard shortcuts — Ctrl+1 through Ctrl+6 tab navigation | `3d7e069` |
| FEAT-054 | UX | ChatHistory keyboard shortcuts — Ctrl+Enter to send, Shift+? for help overlay, Escape dismisses overlay | `3d7e069` |
| FEAT-050 | UX | Light/dark mode toggle for Settings window — `theme` config field, toggle in GeneralConfig, CSS overrides | `3d7e069` |
| FEAT-044 | Security | API key encryption via `keytar` — keys stored in OS keyring, `useKeychain` config toggle, `SecureStorage` module | `3d7e069` |
| TECH-001 | DevEx | Fixed hardcoded `width: 1920, height: 1080` in `captureWithGDI()` — now reads actual dimensions from `nativeImage.getSize()` | `3d7e069` |
| TECH-002 | DevEx | Extracted duplicate rate limiting logic into shared `RateLimiter` class (`rate-limiter.ts`, 5 unit tests) | `3d7e069` |
| TECH-003 | DevEx | Replaced `console.error` with `logger.error` in `ProviderManager.analyze()` and `streamAnalyze()` | `3d7e069` |

---

## Open Opportunities

### High Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-046 | Feature | **Implement auto-update** — Add `electron-updater` and configure GitHub releases as the update provider. Add IPC handler for `app:update` and a UI indicator in Settings. | Medium | Medium |
| FEAT-047 | Security | **Add code signing for Windows** — Unsigned executables trigger Windows SmartScreen warnings. Add `CSC_LINK` and `CSC_KEY_PASSWORD` env vars to CI and electron-builder config. | High | Medium |

### Medium Priority

| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| FEAT-056 | Feature | Active provider badge in overlay — Show which AI provider generated the overlay response (e.g., "via Gemini 2.5 Flash") as a small label in the overlay. | Low | Low | `4a1e2c3` |
| FEAT-045 | Security | Add Zod-based IPC input validation — Several IPC handlers accept untyped `unknown` payloads. Replaced manual type guards with Zod schema validation at the IPC boundary via `validateIPC()` helper. Added `src/main/schemas.ts` with typed schemas. | `e92fc53` |

### Technical Debt

| ID | Description | Location | Effort |
|----|-------------|----------|--------|
| TECH-004 | **Redundant early return in memreader start()** — Investigated: NOT redundant. The IPC caller (`plugin:memreader:start`) calls `start()` without a pre-check, and the guard prevents double-spawn. Safe as-is. | `src/main/plugins/memreader.ts` | N/A |
| TECH-005 | **Memreader polling interval not cleared on port change** — If the port changes while the plugin is running, `updateConfig()` restarts polling, but the old `pollTimer` reference is retained until `stopPolling()` is called. This is handled but could be cleaner. | `src/main/plugins/memreader.ts` `updateConfig()` | Low |

---

## Implementation Roadmap

### Completed (Week 1-5)
All Week 1–5 items from the original roadmap are complete:
- FEAT-001 through FEAT-020 (bug fixes, UX, performance, features)
- FEAT-021 through FEAT-028 (advanced features: custom theme, chat export, OCR, screen recording)
- FEAT-030 (telemetry), FEAT-035 (CI), FEAT-039 (command injection fix)

### Recently Completed (Week 6)
- FEAT-051 — Overlay navigation security (will-navigate + setWindowOpenHandler blockers)
- FEAT-052 — Explicit contextIsolation: true on both BrowserWindow configs

### Recently Completed (Week 7)
- FEAT-043 — Active provider switching UI
- FEAT-053 — Capture mode selection UI
- FEAT-049 — Settings keyboard shortcuts (Ctrl+1–6)
- TECH-001 — Fixed hardcoded dimensions in GDI+ capture
- TECH-002 — Extracted RateLimiter class with unit tests
- TECH-003 — Replaced console.error with logger in ProviderManager

### Recently Completed (Week 8)
- FEAT-044 — API key encryption via keytar (OS keyring, useKeychain toggle)
- FEAT-050 — Light/dark mode toggle for Settings window
- FEAT-054 — ChatHistory keyboard shortcuts (Ctrl+Enter, Shift+? help, Escape dismiss)

### Current Focus (Week 9)
1. FEAT-046 — Auto-update
2. FEAT-047 — Code signing (Windows)
3. FEAT-055 — TypeScript strictness audit

### Completed
- FEAT-045 — Zod IPC input validation (`e92fc53`)
- FEAT-056 — Active provider badge in overlay (`4a1e2c3`)

### Future (Week 10+)
1. Remaining technical debt (TECH-005)
2. Any new suggestions from usage feedback
