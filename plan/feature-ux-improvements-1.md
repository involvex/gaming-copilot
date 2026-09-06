---
goal: UX improvements — hotkey recorder, per-monitor overlay, screenshot annotation, dynamic Gemini models, persistent overlay mode
version: 1.0
date_created: 2025-09-06
last_updated: 2025-09-06
owner: Gaming Copilot team
status: 'Planned'
tags: ['feature', 'ux', 'overlay', 'capture', 'providers']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Five UX improvements targeting the highest-priority pain points identified from the current codebase. These changes touch the hotkey configuration flow, overlay positioning logic, screenshot workflow, Gemini provider integration, and overlay lifecycle behavior.

## 1. Requirements & Constraints

- **REQ-001**: Hotkey recorder must capture key combinations via `globalShortcut` API, validate against Electron's supported accelerator syntax, and surface conflicts before saving.
- **REQ-002**: Per-monitor overlay must position the overlay on the same display as the active game window (or primary display if no game is running).
- **REQ-003**: Screenshot annotation must allow drawing rectangles, arrows, and text on a screenshot before sending it to AI analysis.
- **REQ-004**: Dynamic Gemini models must fetch available models from the Generative AI API and populate the model dropdown.
- **REQ-005**: Persistent overlay mode must allow the overlay to stay visible beyond the auto-dismiss timer, with a pin button in the overlay UI.
- **SEC-001**: All new Electron IPC handlers must validate inputs via zod schemas (per-key validation pattern already established).
- **CON-001**: Must maintain compatibility with existing `AppConfig` type and electron-store schema.
- **CON-002**: Must not break existing tests (269 tests must remain green).
- **GUD-001**: Follow existing patterns: pure logic in `src/main/`, IPC handlers in `src/main/ipc/`, preload typed API in `src/preload/`, React components in `src/renderer/src/components/`.
- **PAT-001**: New UI components go in `src/renderer/src/components/` with barrel exports from `ui/index.ts`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Hotkey recorder UI + per-monitor overlay positioning

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Add `HotkeyRecorder` React component in `src/renderer/src/components/HotkeyRecorder.tsx`: renders a button that, when focused, listens for `keydown`, calls `event.preventDefault()`, builds an Electron accelerator string (e.g., `CommandOrControl+Shift+G`), displays it, and validates via a new `validateHotkey` IPC call. Supports Escape to cancel recording and shows conflict warnings. | | |
| TASK-002 | Add `validateHotkey` IPC handler in `src/main/ipc/hotkeys.ts`: calls `globalShortcut.isRegistered(candidate)` and returns `{ valid: boolean, conflict: boolean, registeredBy: string | null }`. Must validate accelerator format before checking registration. | | |
| TASK-003 | Add `validateHotkey` to preload `ElectronAPI` in `src/preload/index.ts` and wire `ipcRenderer.invoke("hotkeys:validate", candidate)`. | | |
| TASK-004 | Replace raw `<Input>` hotkey fields in Settings with `<HotkeyRecorder>` for capture hotkey, overlay toggle hotkey, and any other hotkey inputs. Update `ProviderConfig` or `Capture` settings tab to use the new component. | | |
| TASK-005 | Add `getActiveDisplay` function in `src/main/index.ts`: when capture hotkey fires, after `smartCapture` resolves, detect which display the captured window/game is on using `screen.getDisplayMatching(workArea)` on the captured window bounds. Store `lastActiveDisplay` on `appConfig` (new field, persisted). | | |
| TASK-006 | Update `calculateOverlayPosition` in `src/main/index.ts` to accept an optional `display` parameter; if provided, use `display.workAreaSize` instead of `screen.getPrimaryDisplay().workAreaSize`. If no display info available, fall back to primary. | | |
| TASK-007 | Update overlay creation and reposition logic to use the active display. When overlay is shown after capture, call `repositionOverlay()` with the active display. | | |
| TASK-008 | Add `lastActiveDisplay` to `AppConfig` type in `src/shared/types.ts` and to `getDefaultConfig` / electron-store schema. | | |
| TASK-009 | Add unit tests for `validateHotkey` IPC handler in `src/main/__tests__/hotkeys.test.ts` (pure mock, no Electron runtime). | | |
| TASK-010 | Add unit tests for `calculateOverlayPosition` with multi-display work areas in `src/main/__tests__/overlay-position.test.ts`. | | |

### Implementation Phase 2

- GOAL-002: Screenshot annotation tool + dynamic Gemini models

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-011 | Add `AnnotationCanvas` React component in `src/renderer/src/components/AnnotationCanvas.tsx`: renders an `<canvas>` overlay on top of the screenshot image. Supports: rectangle drawing (mousedown → drag → mouseup), arrow drawing (line with arrowhead), and text labels (click to place, type to add). Toolbar with tool selection (select/rect/arrow/text), color picker, and undo/clear buttons. | | |
| TASK-012 | Integrate `AnnotationCanvas` into the screenshot flow: after capture, before sending to AI, show a modal with the screenshot + annotation tools and "Analyze with annotations" / "Skip annotations" buttons. | | |
| TASK-013 | Add `annotateScreenshot` IPC handler in `src/main/ipc/screenshots.ts` that accepts annotated image data (base64 or buffer) and forwards it to the AI pipeline. Or keep annotation purely in renderer: serialize canvas to data URL and pass to existing `analyzeStream`. | | |
| TASK-014 | Add `fetchGeminiModels` method to `GeminiProvider` in `src/main/ai-providers/gemini.ts`: call `this.client.models.list()` (or equivalent endpoint) to retrieve available models. Return `Array<{ name: string; displayName: string }>`. | | |
| TASK-015 | Wire `fetchGeminiModels` into `ProviderManager.fetchModelsForProvider`: add a `"gemini"` branch that calls `provider.fetchModels()` (the method is already optional in the interface). | | |
| TASK-016 | Update `ProviderConfig.tsx` to show a "Fetch Models" button for Gemini (similar to existing Zen/Kilo fetch buttons), and populate the Gemini model dropdown with the fetched list. Show a loading state while fetching. | | |
| TASK-017 | Add tests for `fetchGeminiModels` in `src/main/ai-providers/__tests__/gemini.test.ts` (mock the GoogleGenAI client). | | |
| TASK-018 | Add tests for `AnnotationCanvas` in `src/renderer/src/components/AnnotationCanvas.test.tsx` (canvas drawing, tool switching, undo). | | |

### Implementation Phase 3

- GOAL-003: Persistent overlay mode + polish

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-019 | Add `persistent` field to `OverlayConfig` in `src/shared/types.ts` and `src/shared/constants.ts` (`DEFAULT_OVERLAY.persistent = false`). Add zod schema entry in `src/main/schemas.ts`. | | |
| TASK-020 | Add a pin/thumbtack button to the overlay UI (`src/renderer/src/components/Overlay.tsx`): when clicked, sets `persistent = true` and cancels the auto-dismiss timer. When pinned, show a visual indicator (e.g., colored border or pin icon). Click again to unpin. | | |
| TASK-021 | Update overlay lifecycle in `src/main/index.ts`: when `overlay:stream-done` fires, if `persistent` is false, start the auto-dismiss timer; if true, keep visible until manually hidden. Add `overlay:set-persistent` IPC handler to toggle persistence from renderer. | | |
| TASK-022 | Add `setPersistent` to preload `ElectronAPI` and wire it in `src/preload/index.ts`. | | |
| TASK-023 | Persist `persistent` state to config so it survives app restarts. | | |
| TASK-024 | Add tests for persistent overlay behavior in `src/main/__tests__/overlay.test.ts` (verify timer is canceled when persistent, overlay stays visible). | | |
| TASK-025 | Run full verification: `bun run build`, `bun run test` (must remain 269+ tests, all green), `bun run lint`, `bun run typecheck`. | | |

## 3. Alternatives

- **ALT-001 (Hotkey recorder)**: Use a library like `hotkeys-js` — rejected because the app already uses Electron's `globalShortcut` and adding a library would duplicate functionality.
- **ALT-002 (Per-monitor overlay)**: Let users manually pick a display in settings — rejected because auto-detection from game window is more intuitive and requires no extra UI.
- **ALT-003 (Screenshot annotation)**: Use an external image editor — rejected because inline annotation keeps the workflow inside the app and enables immediate AI analysis.
- **ALT-004 (Dynamic Gemini models)**: Hardcode a larger list — rejected because Google adds models regularly; fetching ensures users always have the latest options.
- **ALT-005 (Persistent overlay)**: Use a system tray toggle only — rejected because the overlay itself should expose the pin control for discoverability.

## 4. Dependencies

- **DEP-001**: No new npm dependencies required; all features use existing Electron APIs, React, and canvas.
- **DEP-002**: `@google/genai` SDK already supports model listing (used in TASK-014).
- **DEP-003**: Existing `screen` module from Electron provides multi-display bounds.

## 5. Files

- **FILE-001**: `src/renderer/src/components/HotkeyRecorder.tsx` — new component
- **FILE-002**: `src/renderer/src/components/HotkeyRecorder.test.tsx` — tests
- **FILE-003**: `src/main/ipc/hotkeys.ts` — new IPC module
- **FILE-004**: `src/main/__tests__/hotkeys.test.ts` — tests
- **FILE-005**: `src/main/__tests__/overlay-position.test.ts` — tests
- **FILE-006**: `src/renderer/src/components/AnnotationCanvas.tsx` — new component
- **FILE-007**: `src/renderer/src/components/AnnotationCanvas.test.tsx` — tests
- **FILE-008**: `src/main/ai-providers/gemini.ts` — modify to add `fetchModels`
- **FILE-009**: `src/main/ai-providers/__tests__/gemini.test.ts` — add tests
- **FILE-010**: `src/renderer/src/components/Overlay.tsx` — modify for persistent mode + pin button
- **FILE-011**: `src/renderer/src/components/OverlayStyle.tsx` — add persistent toggle
- **FILE-012**: `src/renderer/src/components/ProviderConfig.tsx` — add Gemini model fetch button
- **FILE-013**: `src/main/index.ts` — modify `calculateOverlayPosition`, overlay lifecycle, active display detection
- **FILE-014**: `src/main/schemas.ts` — add `persistent` schema entry, `hotkey` validation
- **FILE-015**: `src/shared/types.ts` — add `lastActiveDisplay` to `AppConfig`, `persistent` to `OverlayConfig`
- **FILE-016**: `src/shared/constants.ts` — add `DEFAULT_OVERLAY.persistent`
- **FILE-017**: `src/preload/index.ts` — add `validateHotkey`, `setPersistent` to `ElectronAPI`
- **FILE-018**: `src/main/ipc/screenshots.ts` — possibly add annotation handler
- **FILE-019**: `src/main/__tests__/overlay.test.ts` — new test file
- **FILE-020**: `src/renderer/src/components/ui/index.ts` — add `HotkeyRecorder` barrel export if needed

## 6. Testing

- **TEST-001**: `HotkeyRecorder` unit tests: valid accelerator capture, invalid accelerator rejection, Escape cancellation, conflict detection via mocked IPC.
- **TEST-002**: `hotkeys:validate` IPC tests: valid hotkey returns `{ valid: true }`, conflicting hotkey returns `{ conflict: true }`, malformed accelerator returns `{ valid: false }`.
- **TEST-003**: `calculateOverlayPosition` tests: primary display fallback, secondary display positioning, corner math for each position value.
- **TEST-004**: `AnnotationCanvas` tests: rectangle drawing, arrow drawing, text placement, undo, clear, tool switching.
- **TEST-005**: `fetchGeminiModels` tests: mocked `GoogleGenAI.models.list()` returns model list, error handling on API failure.
- **TEST-006**: Persistent overlay tests: overlay stays visible when `persistent=true`, auto-dismiss fires when `persistent=false`, pin toggle persists to config.
- **TEST-007**: Full regression: `bun run test` must pass all 269+ tests, `bun run typecheck` must pass, `bun run lint` must pass.

## 7. Risks & Assumptions

- **RISK-001**: `globalShortcut.isRegistered()` only works for shortcuts registered by the current app; it cannot detect conflicts with other apps' shortcuts. Mitigation: document this limitation and only check for internal conflicts.
- **RISK-002**: `screen.getDisplayMatching()` requires valid bounds; if capture fails or returns no bounds, fallback to primary display must be robust.
- **RISK-003**: Canvas annotation in the renderer may have DPI scaling issues on high-DPI displays; need to account for `devicePixelRatio`.
- **ASSUMPTION-001**: The `@google/genai` SDK exposes a `models.list()` method or equivalent REST endpoint for fetching available models.
- **ASSUMPTION-002**: Electron's `globalShortcut` supports all key combinations the user might want; some key combinations (e.g., `F1`–`F24` without modifiers) may be reserved by the OS.

## 8. Related Specifications / Further Reading

- [Electron globalShortcut docs](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [Electron screen module docs](https://www.electronjs.org/docs/latest/api/screen)
- [Google Generative AI SDK — List Models](https://ai.google.dev/gemini-api/docs/models)
- [HTML Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
