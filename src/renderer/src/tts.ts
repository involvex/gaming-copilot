export interface TTSConfig {
  enabled: boolean;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
}

let _currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, config: TTSConfig): void {
  if (!config.enabled) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Clean text (remove markdown-like formatting)
  const cleanText = text.replace(/[*_#`]/g, "").replace(/\n+/g, ". ");

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = config.rate;
  utterance.pitch = config.pitch;
  utterance.volume = config.volume;

  if (config.voice) {
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.name === config.voice);
    if (match) utterance.voice = match;
  }

  _currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stop(): void {
  window.speechSynthesis.cancel();
  _currentUtterance = null;
}

export function getAvailableVoices(): Array<{ name: string; lang: string }> {
  return window.speechSynthesis.getVoices().map((v) => ({
    name: v.name,
    lang: v.lang,
  }));
}

export function isSpeaking(): boolean {
  return window.speechSynthesis.speaking;
}

export function preview(config: TTSConfig): void {
  const sampleText =
    "This is a preview of your text-to-speech settings. Adjust voice, speed, pitch, and volume as needed.";
  const previewConfig: TTSConfig = { ...config, enabled: true };
  speak(sampleText, previewConfig);
}
