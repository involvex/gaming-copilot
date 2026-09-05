import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function TestDialog({
  active = true,
  withInitial = true,
}: {
  active?: boolean;
  withInitial?: boolean;
}) {
  const { containerRef, initialFocusRef, onKeyDown } = useFocusTrap<HTMLDivElement>(active);
  return (
    <div role="dialog" aria-label="Test dialog" onKeyDown={onKeyDown}>
      <div ref={containerRef} tabIndex={-1}>
        <button type="button">First</button>
        <input aria-label="Middle" type="text" />
        {withInitial && (
          <button type="button" ref={initialFocusRef}>
            Initial
          </button>
        )}
        <button type="button">Last</button>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the initial-focus element when activated", () => {
    render(<TestDialog />);
    expect(screen.getByRole("button", { name: "Initial" })).toBe(document.activeElement);
  });

  it("falls back to the first focusable element without an initial target", () => {
    render(<TestDialog withInitial={false} />);
    expect(screen.getByRole("button", { name: "First" })).toBe(document.activeElement);
  });

  it("wraps Tab from last to first and Shift+Tab from first to last", () => {
    render(<TestDialog />);
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });

    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("button", { name: "First" })).toBe(document.activeElement);

    const first = screen.getByRole("button", { name: "First" });
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toBe(document.activeElement);
  });

  it("does not intercept non-Tab keys or mid-list Tabs", () => {
    render(<TestDialog />);
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });

    const middle = screen.getByLabelText("Middle");
    middle.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(middle).toBe(document.activeElement);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(middle).toBe(document.activeElement);
  });

  it("does not steal focus while inactive", () => {
    render(<TestDialog active={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("restores focus to the previously focused element on deactivation", () => {
    function RestoreDialog({ active }: { active: boolean }) {
      const { containerRef, onKeyDown } = useFocusTrap<HTMLDivElement>(active);
      return (
        <div>
          <button type="button">Trigger</button>
          {active && (
            <div role="dialog" aria-label="Restore dialog" onKeyDown={onKeyDown}>
              <div ref={containerRef} tabIndex={-1}>
                <button type="button">Inside</button>
              </div>
            </div>
          )}
        </div>
      );
    }

    const { rerender } = render(<RestoreDialog active={false} />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    rerender(<RestoreDialog active={true} />);
    expect(screen.getByRole("button", { name: "Inside" })).toBe(document.activeElement);
    rerender(<RestoreDialog active={false} />);
    expect(trigger).toBe(document.activeElement);
  });

  it("calls onEscape for Escape and ignores other keys", () => {
    function EscapeDialog({ onEscape }: { onEscape: () => void }) {
      const { containerRef, onKeyDown } = useFocusTrap<HTMLDivElement>(true, {
        onEscape,
      });
      return (
        <div role="dialog" aria-label="Escape dialog" onKeyDown={onKeyDown}>
          <div ref={containerRef} tabIndex={-1}>
            <button type="button">Inside</button>
          </div>
        </div>
      );
    }

    const onEscape = vi.fn();
    render(<EscapeDialog onEscape={onEscape} />);
    const dialog = screen.getByRole("dialog", { name: "Escape dialog" });
    const inside = screen.getByRole("button", { name: "Inside" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);

    inside.focus();
    fireEvent.keyDown(dialog, { key: "Enter" });
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
