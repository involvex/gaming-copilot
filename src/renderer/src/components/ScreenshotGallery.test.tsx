import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScreenshotGallery from "./ScreenshotGallery";
import { ConfirmProvider } from "./ui/ConfirmDialog";
import { ToastProvider } from "./ui/Toast";

const mockElectronAPI = {
  listScreenshots: vi.fn(),
  deleteScreenshot: vi.fn(),
  openScreenshot: vi.fn(),
  openContainingFolder: vi.fn(),
  copyPath: vi.fn(),
  getTags: vi.fn(),
  setTags: vi.fn(),
  toggleFavorite: vi.fn(),
  getFavorites: vi.fn(),
  bulkRename: vi.fn(),
  getMetadata: vi.fn(),
  exportZip: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.listScreenshots.mockResolvedValue([
    {
      filename: "a.png",
      path: "C:\\shots\\a.png",
      size: 1024,
      mtime: Date.now() - 1000,
    },
    {
      filename: "b.png",
      path: "C:\\shots\\b.png",
      size: 2048,
      mtime: Date.now(),
    },
  ]);
  mockElectronAPI.getTags.mockResolvedValue({});
  mockElectronAPI.getFavorites.mockResolvedValue({});

  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ConfirmProvider>
      <ToastProvider>{ui}</ToastProvider>
    </ConfirmProvider>,
  );
}

describe("ScreenshotGallery", () => {
  it("loads and displays screenshots", async () => {
    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
    expect(screen.getByText("b.png")).toBeInTheDocument();
    expect(mockElectronAPI.listScreenshots).toHaveBeenCalled();
  });

  it("shows loading state initially", () => {
    renderWithProviders(<ScreenshotGallery />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error when loading fails", async () => {
    mockElectronAPI.listScreenshots.mockRejectedValueOnce(new Error("fail"));
    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("fail")).toBeInTheDocument());
  });

  it("deletes a screenshot after confirmation", async () => {
    const user = userEvent.setup();
    mockElectronAPI.deleteScreenshot.mockResolvedValue(true);

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Delete.*\?/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockElectronAPI.deleteScreenshot).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles favorite on click", async () => {
    const user = userEvent.setup();
    mockElectronAPI.toggleFavorite.mockResolvedValue(true);

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    const favoriteButtons = screen.getAllByLabelText("Add to favorites");
    await user.click(favoriteButtons[0]);

    expect(mockElectronAPI.toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("opens bulk rename dialog in select mode", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    await user.click(screen.getByText("Select"));
    const checkbox = screen.getByRole("checkbox", { name: /select all/i });
    await user.click(checkbox);

    expect(screen.getByText("Rename Selected (2)")).toBeEnabled();
  });

  it("loads metadata when info button is clicked in preview", async () => {
    const user = userEvent.setup();
    mockElectronAPI.getMetadata.mockResolvedValue({
      filename: "a.png",
      path: "C:\\shots\\a.png",
      sizeBytes: 1024,
      width: 1920,
      height: 1080,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      format: "PNG",
    });

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    const imageButton = screen.getByAltText("a.png").closest("button");
    expect(imageButton).toBeTruthy();
    fireEvent.click(imageButton!);

    await waitFor(() => expect(screen.getByText("Info")).toBeInTheDocument());

    await user.click(screen.getByText("Info"));

    await waitFor(() => expect(screen.getByText("Dimensions: 1920 × 1080")).toBeInTheDocument());
    expect(mockElectronAPI.getMetadata).toHaveBeenCalledWith("a.png");
  });

  it("keeps bulk rename dialog open when interacting with fields, closes on backdrop", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    await user.click(screen.getByText("Select"));
    await user.click(screen.getByRole("checkbox", { name: /select all/i }));
    await user.click(screen.getByText(/Rename Selected/));

    const dialog = await screen.findByRole("dialog", { name: "Bulk rename" });

    fireEvent.click(screen.getByLabelText("Value"));
    expect(screen.getByRole("dialog", { name: "Bulk rename" })).toBeInTheDocument();

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog", { name: "Bulk rename" })).not.toBeInTheDocument();
  });

  it("closes bulk rename dialog on Escape and traps Tab focus", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    await user.click(screen.getByText("Select"));
    await user.click(screen.getByRole("checkbox", { name: /select all/i }));
    await user.click(screen.getByText(/Rename Selected/));

    const dialog = await screen.findByRole("dialog", { name: "Bulk rename" });

    await waitFor(() => expect(document.activeElement?.getAttribute("id")).toBe("rename-mode"));

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    cancelButton.focus();
    fireEvent.keyDown(cancelButton, { key: "Tab" });
    expect(document.activeElement?.getAttribute("id")).toBe("rename-mode");

    const modeSelect = screen.getByLabelText("Mode");
    modeSelect.focus();
    fireEvent.keyDown(modeSelect, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Bulk rename" })).not.toBeInTheDocument();
  });

  it("keeps compare dialog open when using the slider, closes on backdrop", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ScreenshotGallery />);

    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());

    const imageButton = screen.getByAltText("a.png").closest("button");
    expect(imageButton).toBeTruthy();
    fireEvent.click(imageButton!);

    const previewDialog = await screen.findByRole("dialog", {
      name: "Screenshot preview",
    });
    await user.click(within(previewDialog).getByRole("button", { name: "Compare" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Image comparison",
    });

    fireEvent.click(screen.getByRole("button", { name: /comparison slider/i }));
    expect(screen.getByRole("dialog", { name: "Image comparison" })).toBeInTheDocument();

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog", { name: "Image comparison" })).not.toBeInTheDocument();
  });
});
