import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HotkeyRecorder from "./HotkeyRecorder";
import { ToastProvider } from "./ui/Toast";

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("HotkeyRecorder", () => {
  it("renders the current value", () => {
    renderWithToast(<HotkeyRecorder value="CommandOrControl+Shift+G" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("CommandOrControl+Shift+G");
  });

  it("renders placeholder when value is empty", () => {
    renderWithToast(<HotkeyRecorder value="" onChange={() => {}} placeholder="Ctrl+Shift+G" />);
    expect(screen.getByRole("button")).toHaveTextContent("Ctrl+Shift+G");
  });

  it("shows recording indicator when recording", () => {
    renderWithToast(<HotkeyRecorder value="" onChange={() => {}} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button).toHaveTextContent("Press keys...");
    expect(button.textContent).toContain("recording...");
  });

  it("does not respond when disabled", () => {
    renderWithToast(<HotkeyRecorder value="" onChange={() => {}} disabled />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
