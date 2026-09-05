import { useEffect, useState } from "react";
import type { ChatMessage } from "../../../shared/types";
import { Button } from "./ui";
import { useConfirm } from "./ui/ConfirmDialog";

interface PendingRequest {
  msgId: string;
  imageBase64: string;
  mimeType: string;
  screenshot?: string;
  userMessage: string;
}

export default function ChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    window.electronAPI.loadChatHistory().then((saved) => {
      if (saved && saved.length > 0) {
        setMessages(saved);
      }
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      window.electronAPI.saveChatHistory(messages);
    }
  }, [messages]);

  const startAnalysis = (screenshot: string | null, userMessage: string) => {
    setAnalyzing(true);
    const mimeType = screenshot?.match(/^data:(image\/(?:png|jpeg))/)?.[1] ?? "image/png";
    const base64 = screenshot?.replace(/^data:image\/(?:png|jpeg);base64,/, "") ?? "";

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Analyzing...",
      screenshot: screenshot || undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setPendingRequest({
      msgId: assistantMsg.id,
      imageBase64: base64,
      mimeType,
      screenshot: screenshot || undefined,
      userMessage,
    });

    window.electronAPI.analyzeStream(
      base64,
      userMessage,
      (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: m.text + chunk, isError: false } : m,
          ),
        );
      },
      () => {
        setAnalyzing(false);
        setPendingRequest(null);
      },
      (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: `Error: ${error}`, isError: true } : m,
          ),
        );
        setAnalyzing(false);
        setPendingRequest(null);
      },
    );
  };

  const handleSend = async () => {
    if (!input.trim() || analyzing) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const userText = input.trim();
    setInput("");

    try {
      const result = await window.electronAPI.captureScreenshot();
      if (result) {
        startAnalysis(result, userText);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Failed to capture screenshot",
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Error: ${errMsg}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    }
  };

  const handleRetry = () => {
    if (!pendingRequest) return;
    setMessages((prev) =>
      prev.filter(
        (m) =>
          !(
            m.text === "Analyzing..." &&
            m.role === "assistant" &&
            m.screenshot === pendingRequest.screenshot
          ),
      ),
    );
    startAnalysis(pendingRequest.screenshot || null, pendingRequest.userMessage);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = async () => {
    const ok = await confirm({
      message: "Clear all chat history?",
      variant: "danger",
    });
    if (!ok) return;
    await window.electronAPI.clearChatHistory();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "?" && e.shiftKey) {
      setShowShortcuts(true);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  const CopyIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="4" />
      <path d="M19.4 15a1.65 1.65 0 0 1-1.2 1.83 9 9 0 0 1-1.2.27 9 9 0 0 1-8.27-5.33 9 9 0 0 1-.17-1.2 9 9 0 0 1 .27-1.2A1.65 1.65 0 0 1 4.8 7" />
      <polyline points="12 12 12 12 12 12" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] sm:h-[calc(100vh-280px)]">
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-4 py-3">
        {messages.length === 0 && (
          <p className="text-[var(--color-text-tertiary)] text-center text-sm py-8">
            Press <kbd className="kbd">Ctrl+Shift+G</kbd> or type a message to analyze a screenshot.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 relative group border ${
                msg.role === "user"
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                  : msg.isError
                    ? "bg-[var(--color-error)]/10 border-[var(--color-error)] text-[var(--color-error)]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              }`}
            >
              {msg.screenshot && (
                <img
                  src={msg.screenshot}
                  alt="Screenshot"
                  className="rounded mb-2 max-h-32 object-contain"
                />
              )}
              <p className="text-sm whitespace-pre-wrap pr-6">{msg.text}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] opacity-50">
                  {formatTime(msg.timestamp)}
                  {msg.provider && ` · ${msg.provider}`}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {msg.role === "assistant" && !msg.isError && msg.text.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="p-0.5 hover:bg-[var(--color-surface-hover)] rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === msg.id ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  )}
                  {msg.isError && pendingRequest && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="p-0.5 hover:bg-[var(--color-surface-hover)] rounded transition-colors"
                      title="Retry"
                    >
                      <RefreshIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {analyzing && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-[var(--color-text-secondary)] text-sm">
              Analyzing screenshot...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your game..."
          className="input flex-1"
          disabled={analyzing}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={analyzing || !input.trim()}
        >
          Send
        </Button>
        {messages.length > 0 && (
          <Button variant="danger" size="md" onClick={handleClearHistory} disabled={analyzing}>
            Clear
          </Button>
        )}
      </div>

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <kbd className="kbd">Ctrl+G</kbd>
                <span className="text-[var(--color-text-secondary)]">
                  Capture &amp; analyze screenshot
                </span>
              </div>
              <div className="flex justify-between">
                <kbd className="kbd">Ctrl+Enter</kbd>
                <span className="text-[var(--color-text-secondary)]">Send message (in chat)</span>
              </div>
              <div className="flex justify-between">
                <kbd className="kbd">Escape</kbd>
                <span className="text-[var(--color-text-secondary)]">Dismiss overlay</span>
              </div>
              <div className="flex justify-between">
                <kbd className="kbd">Ctrl+1–6</kbd>
                <span className="text-[var(--color-text-secondary)]">Switch Settings tab</span>
              </div>
              <div className="flex justify-between">
                <kbd className="kbd">Shift+?</kbd>
                <span className="text-[var(--color-text-secondary)]">Show this help (in chat)</span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setShowShortcuts(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
