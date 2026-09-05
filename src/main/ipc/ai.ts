import { ipcMain } from "electron";
import { z } from "zod";
import { extractText } from "../ocr";
import { validateIPC } from "../schemas";
import type { IpcContext } from "./context";

const aiAnalyzeSchema = z.object({
  imageBase64: z.string().min(1),
  userMessage: z.string().optional(),
});

export function registerAiHandlers(ctx: IpcContext): void {
  ipcMain.handle("ai:analyze", async (_event, imageBase64: unknown, userMessage?: unknown) => {
    const parsed = validateIPC(aiAnalyzeSchema, { imageBase64, userMessage });
    if (!ctx.providerManager) return { error: "Provider manager not initialized" };

    let ocrContext: string | undefined;
    if (ctx.appConfig.ocr.enabled) {
      try {
        const dataUrl = `data:image/png;base64,${parsed.imageBase64}`;
        const ocrResult = await extractText(dataUrl, ctx.appConfig.ocr);
        if (ocrResult.text) {
          ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "OCR failed";
        ctx.logger.warn("OCR", `Failed to extract text: ${msg}`);
      }
    }

    const gameExe = ctx.appConfig.gameExe;
    const gameEntry = ctx.appConfig.games.find((g) => g.exe === gameExe);
    const gameContext =
      gameEntry && gameEntry.urls.length > 0
        ? `Game documentation URLs:\n${gameEntry.urls.join("\n")}`
        : undefined;
    const context = [ocrContext, gameContext].filter(Boolean).join("\n\n");

    try {
      const response = await ctx.providerManager.analyze(
        parsed.imageBase64,
        "image/png",
        ctx.appConfig.prompts.system,
        parsed.userMessage || "Analyze this game screenshot.",
        context || undefined,
      );
      return { response };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      return { error: message };
    }
  });

  ipcMain.handle("ai:test-provider", async (_event, name: unknown) => {
    const validName = validateIPC(z.string().min(1), name);
    if (!ctx.providerManager) return false;
    return ctx.providerManager.testProvider(validName);
  });

  ipcMain.on("ai:analyze-stream", async (event, imageBase64: string, userMessage?: string) => {
    if (!ctx.providerManager) {
      event.sender.send("ai:stream-error", "Provider manager not initialized");
      return;
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`;
    event.sender.send("overlay:data", "Analyzing screenshot...");
    event.sender.send("overlay:screenshot", dataUrl);
    ctx.overlayWindow?.show();

    const gameExe = ctx.appConfig.gameExe;
    const gameSpecificPrompt = gameExe ? ctx.appConfig.prompts.gameSpecific?.[gameExe] : undefined;
    const finalPrompt = gameSpecificPrompt
      ? `${ctx.appConfig.prompts.system}\n\n${gameSpecificPrompt}`
      : ctx.appConfig.prompts.system;

    let ocrContext: string | undefined;
    if (ctx.appConfig.ocr.enabled) {
      try {
        const ocrResult = await extractText(dataUrl, ctx.appConfig.ocr);
        if (ocrResult.text) {
          ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "OCR failed";
        ctx.logger.warn("OCR", `Failed to extract text: ${msg}`);
      }
    }

    const gameEntry = ctx.appConfig.games.find((g) => g.exe === gameExe);
    const gameContext =
      gameEntry && gameEntry.urls.length > 0
        ? `Game documentation URLs:\n${gameEntry.urls.join("\n")}`
        : undefined;
    const context = [ocrContext, gameContext].filter(Boolean).join("\n\n");

    try {
      let fullText = "";
      for await (const chunk of ctx.providerManager.streamAnalyze(
        imageBase64,
        "image/png",
        finalPrompt,
        userMessage || "Analyze this game screenshot.",
        context || undefined,
      )) {
        if (!chunk.done) {
          fullText += chunk.text;
          event.sender.send("ai:stream-chunk", chunk.text);
        }
      }
      event.sender.send("ai:stream-done", fullText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      event.sender.send("ai:stream-error", message);
    }
  });

  ipcMain.handle("ai:get-providers", () => {
    if (!ctx.providerManager) return [];
    return ctx.providerManager.getAvailableProviders().map((p) => ({
      name: p.name,
      displayName: p.displayName,
      rateLimit: p.getRateLimitInfo(),
    }));
  });

  ipcMain.handle("ai:clear-cache", () => {
    if (!ctx.providerManager) return false;
    ctx.providerManager.clearCache();
    return true;
  });

  ipcMain.handle("ai:fetch-models", async (_event, name: unknown) => {
    const validName = validateIPC(z.string().min(1), name);
    if (!ctx.providerManager) {
      throw new Error("Provider manager not initialized");
    }
    return ctx.providerManager.fetchModelsForProvider(validName);
  });
}
