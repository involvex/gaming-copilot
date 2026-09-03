import Tesseract from "tesseract.js";

export interface OcrConfig {
  enabled: boolean;
  language: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

let worker: Tesseract.Worker | null = null;
let workerLanguage = "eng";

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker();
    await worker.load();
    await worker.reinitialize("eng");
    workerLanguage = "eng";
  }
  return worker;
}

export async function extractText(imageDataUrl: string, config: OcrConfig): Promise<OcrResult> {
  if (!config.enabled || !imageDataUrl) {
    return { text: "", confidence: 0 };
  }

  const w = await getWorker();

  if (workerLanguage !== config.language) {
    await w.reinitialize(config.language);
    workerLanguage = config.language;
  }

  try {
    const {
      data: { text, confidence },
    } = await w.recognize(imageDataUrl);

    return {
      text: text.trim(),
      confidence,
    };
  } catch (error) {
    throw error instanceof Error ? error.message : "OCR processing failed";
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerLanguage = "eng";
  }
}
