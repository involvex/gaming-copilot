import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TitleBar from "./TitleBar";

const mockElectronAPI = {
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#/";
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("TitleBar", () => {
  it("renders brand, nav, and window controls", () => {
    render(<TitleBar />);
    expect(screen.getByText("GAMING COPILOT")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("marks the current route nav item as active", async () => {
    render(<TitleBar />);
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");

    window.location.hash = "#/settings";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
  });

  it("navigates when a nav item is clicked", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(window.location.hash).toBe("#/settings");
  });

  it("calls window controls", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Maximize" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(mockElectronAPI.minimizeWindow).toHaveBeenCalledTimes(1);
    expect(mockElectronAPI.toggleMaximizeWindow).toHaveBeenCalledTimes(1);
    expect(mockElectronAPI.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("toggles maximize on bar double-click but not on control double-click", () => {
    render(<TitleBar />);
    const bar = screen.getByRole("banner");
    fireEvent.doubleClick(bar);
    expect(mockElectronAPI.toggleMaximizeWindow).toHaveBeenCalledTimes(1);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Home" }));
    expect(mockElectronAPI.toggleMaximizeWindow).toHaveBeenCalledTimes(1);
  });
});
