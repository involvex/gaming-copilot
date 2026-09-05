import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  /** Called when Escape is pressed inside the trapped region. */
  onEscape?: () => void;
}

export interface UseFocusTrapResult<T extends HTMLElement> {
  /** Attach to the dialog content element that bounds the trap. */
  containerRef: React.RefObject<T | null>;
  /**
   * Callback ref — attach to the element that should receive focus when the
   * dialog opens. A callback (rather than a RefObject) so it fits natively
   * typed elements (`button`, `input`, `select`, …).
   */
  initialFocusRef: (el: HTMLElement | null) => void;
  /** Spread onto the element that receives bubbled keydown events (usually the backdrop). */
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Focus trap for modal dialogs. When `active`:
 * - moves focus to `initialFocusRef`, else the first focusable element, else the container
 *   (callers should give the container `tabIndex={-1}` so the fallback can land);
 * - wraps Tab / Shift+Tab at the first/last focusable element so focus cannot
 *   escape into the background page;
 * - restores focus to the previously focused element on deactivation/unmount;
 * - invokes `options.onEscape` when Escape is pressed inside the trap.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  options?: UseFocusTrapOptions,
): UseFocusTrapResult<T> {
  const containerRef = useRef<T | null>(null);
  const initialFocusEl = useRef<HTMLElement | null>(null);
  const initialFocusRef = useCallback((el: HTMLElement | null) => {
    initialFocusEl.current = el;
  }, []);

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (container) {
      const target =
        initialFocusEl.current ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (target ?? container).focus();
    }
    return () => {
      // focus() on a detached node is a harmless no-op.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      options?.onEscape?.();
      return;
    }
    if (e.key !== "Tab") return;
    const container = containerRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return { containerRef, initialFocusRef, onKeyDown };
}
