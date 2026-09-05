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
});
