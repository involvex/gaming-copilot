import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNativeImage = {
  createFromBuffer: vi.fn(),
  createFromDataURL: vi.fn(),
  createEmpty: vi.fn(),
};

const mockDesktopCapturer = {
  getSources: vi.fn(),
};

vi.mock("electron", () => ({
  nativeImage: mockNativeImage,
  desktopCapturer: mockDesktopCapturer,
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => Buffer.from("")),
}));

vi.mock("../win32", () => ({
  findProcessByExe: vi.fn(() => null),
  getWindowTitleByPid: vi.fn(() => null),
  isProcessRunning: () => false,
}));

const makeMockImage = (opts: { isEmpty?: boolean; width?: number; height?: number } = {}) => ({
  isEmpty: () => opts.isEmpty ?? false,
  getSize: () => ({
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
  }),
  resize: vi.fn(() => ({
    toBitmap: () => Buffer.alloc(320 * 180 * 4, 128),
    toPNG: () => Buffer.from("resized-png"),
    toJPEG: () => Buffer.from("resized-jpeg"),
  })),
  toPNG: vi.fn(() => Buffer.from("png")),
  toJPEG: vi.fn(() => Buffer.from("jpeg")),
});

describe("capture module", () => {
  let resizeImage: any;
  let captureFullScreen: any;
  let captureWindowByExe: any;
  let captureWithGDI: any;
  let recordScreen: any;
  let smartCapture: any;
  let compositeFrames: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../index");
    resizeImage = mod.resizeImage;
    captureFullScreen = mod.captureFullScreen;
    captureWindowByExe = mod.captureWindowByExe;
    captureWithGDI = mod.captureWithGDI;
    recordScreen = mod.recordScreen;
    smartCapture = mod.smartCapture;
    compositeFrames = mod.compositeFrames;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resizeImage", () => {
    it("should return original buffer if image is empty", () => {
      const buffer = Buffer.from([1, 2, 3]);

      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage({ isEmpty: true }));

      const result = resizeImage(buffer, "png", 85);
      expect(result).toBe(buffer);
    });

    it("should return original buffer if no resize or compression needed", () => {
      const buffer = Buffer.from([1, 2, 3]);
      const mockImage = makeMockImage({ width: 100, height: 50 });
      mockNativeImage.createFromBuffer.mockReturnValue(mockImage);

      const result = resizeImage(buffer, "png", 100);
      expect(result).toBe(buffer);
    });

    it("should resize image when width exceeds maxWidth", () => {
      const buffer = Buffer.from([1, 2, 3]);

      mockNativeImage.createFromBuffer.mockReturnValue(
        makeMockImage({ width: 2048, height: 1024 }),
      );

      resizeImage(buffer, "jpeg", 80, 1024);
      expect(mockNativeImage.createFromBuffer).toHaveBeenCalledWith(buffer);
    });

    it("should compress to JPEG when format is jpeg and quality < 100", () => {
      const buffer = Buffer.from([1, 2, 3]);

      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage({ width: 500, height: 300 }));

      const result = resizeImage(buffer, "jpeg", 80);
      expect(result).toEqual(Buffer.from("jpeg"));
    });

    it("should use default max width of 1024", () => {
      const buffer = Buffer.from([1, 2, 3]);

      const mockImage = makeMockImage({ width: 500, height: 300 });
      mockNativeImage.createFromBuffer.mockReturnValue(mockImage);

      resizeImage(buffer, "png", 100);
      expect(mockImage.resize).not.toHaveBeenCalled();
    });
  });

  describe("captureFullScreen", () => {
    it("should capture fullscreen from specified screen index", async () => {
      const mockThumbnail = {
        toPNG: vi.fn(() => Buffer.from("png-data")),
        toJPEG: vi.fn((q: number) => Buffer.from(`jpeg-${q}`)),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
        { thumbnail: mockThumbnail, name: "Screen 2" },
      ]);

      const result = await captureFullScreen(90, 1);
      expect(result.buffer).toEqual(Buffer.from("jpeg-90"));
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.format).toBe("jpeg");
    });

    it("should throw if screen not found", async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      await expect(captureFullScreen()).rejects.toThrow("No screen found");
    });

    it("should use PNG format when quality >= 100", async () => {
      const mockThumbnail = {
        toPNG: vi.fn(() => Buffer.from("png-data")),
        toJPEG: vi.fn(),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
      ]);

      const result = await captureFullScreen(100);
      expect(mockThumbnail.toPNG).toHaveBeenCalled();
      expect(mockThumbnail.toJPEG).not.toHaveBeenCalled();
      expect(result.format).toBe("png");
    });

    it("should use PNG format when quality is undefined", async () => {
      const mockThumbnail = {
        toPNG: vi.fn(() => Buffer.from("png-data")),
        toJPEG: vi.fn(),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
      ]);

      const result = await captureFullScreen();
      expect(mockThumbnail.toPNG).toHaveBeenCalled();
      expect(result.format).toBe("png");
    });
  });

  describe("smartCapture", () => {
    it("should fall back to fullscreen when exe name is unsafe", async () => {
      const pngData = Buffer.from("png-data");
      const mockThumbnail = {
        toPNG: () => pngData,
        toJPEG: () => Buffer.from("jpeg-data"),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
      ]);

      const result = await smartCapture("evil; rm -rf /", undefined, undefined, 0, "auto");
      expect(result.buffer).toBeDefined();
      expect(result.format).toBe("png");
    });

    it("should use fullscreen when no gameExe provided", async () => {
      const pngData = Buffer.from("png-data");
      const mockThumbnail = {
        toPNG: () => pngData,
        toJPEG: () => Buffer.from("jpeg-data"),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
      ]);

      const result = await smartCapture(undefined, undefined, undefined, 0, "auto");
      expect(result.buffer).toEqual(pngData);
    });
  });

  describe("captureWindowByExe", () => {
    it("should return null if process not found", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(null);

      const result = await captureWindowByExe("gaming.exe");
      expect(result).toBeNull();
    });

    it("should return null if no matching source found", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue(null);

      mockDesktopCapturer.getSources.mockResolvedValue([]);

      const result = await captureWindowByExe("game.exe");
      expect(result).toBeNull();
    });

    it("should capture window when process and source found", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);

      const mockThumbnail = {
        toPNG: () => Buffer.from("png-data"),
        toJPEG: (q: number) => Buffer.from(`jpeg-${q}`),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "game" },
      ]);

      const result = await captureWindowByExe("game.exe", 90);
      expect(result).toBeDefined();
      expect(result?.format).toBe("jpeg");
      expect(result?.buffer).toEqual(Buffer.from("jpeg-90"));
    });

    it("should use PNG when quality is undefined", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);

      const toPNG = vi.fn(() => Buffer.from("png-data"));
      const mockThumbnail = {
        toPNG,
        toJPEG: vi.fn(),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "game" },
      ]);

      const result = await captureWindowByExe("game.exe");
      expect(result?.format).toBe("png");
      expect(toPNG).toHaveBeenCalled();
    });

    it("should return null for unsafe exe name", async () => {
      const result = await captureWindowByExe("evil; rm -rf /");
      expect(result).toBeNull();
    });
  });

  describe("captureWithGDI", () => {
    it("should return null if process not found", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(null);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue(null);

      const result = await captureWithGDI("game.exe");
      expect(result).toBeNull();
    });

    it("should return null if window title not found", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue(null);

      const result = await captureWithGDI("game.exe");
      expect(result).toBeNull();
    });

    it("should return null if window title is empty", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue("");

      const result = await captureWithGDI("game.exe");
      expect(result).toBeNull();
    });

    it("should return null if PowerShell command fails", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue("Game Window");

      const { execSync } = await import("node:child_process");
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("PowerShell error");
      });

      const result = await captureWithGDI("game.exe");
      expect(result).toBeNull();

      vi.mocked(execSync).mockReset();
    });

    it("should return CaptureResult on successful capture", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue("Game Window");

      const { execSync } = await import("node:child_process");
      const base64Output = Buffer.from("fake-captured-image").toString("base64");
      vi.mocked(execSync).mockReturnValue(base64Output);

      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage());

      const result = await captureWithGDI("game.exe", 85);
      expect(result).toBeDefined();
      expect(result?.buffer).toBeDefined();
      expect(result?.width).toBe(1920);
      expect(result?.height).toBe(1080);
      expect(result?.format).toBe("jpeg");

      vi.mocked(execSync).mockReset();
    });

    it("should use PNG format when quality >= 100", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(12345);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue("Game Window");

      const { execSync } = await import("node:child_process");
      const base64Output = Buffer.from("fake-captured-image").toString("base64");
      vi.mocked(execSync).mockReturnValue(base64Output);

      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage());

      const result = await captureWithGDI("game.exe", 100);
      expect(result?.format).toBe("png");

      vi.mocked(execSync).mockReset();
    });

    it("should validate exe name and reject unsafe names", async () => {
      const result = await captureWithGDI("evil; rm -rf /");
      expect(result).toBeNull();
    });

    it("should validate pid before interpolation", async () => {
      const win32Mock = await import("../win32");
      vi.mocked(win32Mock.findProcessByExe).mockReturnValue(-1);
      vi.mocked(win32Mock.getWindowTitleByPid).mockReturnValue("Game Window");

      const result = await captureWithGDI("game.exe");
      expect(result).toBeNull();
    });
  });

  describe("recordScreen", () => {
    it("should return null if screen not found", async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      const result = await recordScreen(5);
      expect(result).toBeNull();
    });

    it("should return null if no frames captured", async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([
        {
          thumbnail: {
            isEmpty: () => true,
            getSize: () => ({ width: 0, height: 0 }),
          },
          name: "Screen 1",
        },
      ]);

      const result = await recordScreen(1, undefined, 0, 2);
      expect(result).toBeNull();
    });

    it("should capture frames and composite them", async () => {
      const mockThumbnail = {
        toPNG: () => Buffer.from("frame-png"),
        toJPEG: () => Buffer.from("frame-jpeg"),
        getSize: () => ({ width: 1920, height: 1080 }),
      };

      mockDesktopCapturer.getSources.mockResolvedValue([
        { thumbnail: mockThumbnail, name: "Screen 1" },
      ]);

      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage({ width: 320, height: 180 }));

      vi.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
        if (typeof cb === "function") cb();
        return 0 as any;
      });

      const result = await recordScreen(2, 90, 0, 2);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.width).toBeDefined();
        expect(result.height).toBeDefined();
        expect(result.format).toBe("jpeg");
      }
    });
  });

  describe("compositeFrames", () => {
    it("should return null for empty frames array", () => {
      const result = compositeFrames([], 0, 0);
      expect(result).toBeNull();
    });

    it("should composite frames into grid", () => {
      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage({ width: 320, height: 180 }));

      const frames = [Buffer.from("frame1"), Buffer.from("frame2")];
      const result = compositeFrames(frames, 2, 1, 90);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.format).toBe("jpeg");
      }
    });

    it("should return null if all images are empty", () => {
      mockNativeImage.createFromBuffer.mockReturnValue(makeMockImage({ isEmpty: true }));

      const frames = [Buffer.from("frame1")];
      const result = compositeFrames(frames, 1, 1);
      expect(result).toBeNull();
    });
  });
});
