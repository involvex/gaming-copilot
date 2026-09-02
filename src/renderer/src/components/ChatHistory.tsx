import { useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  screenshot?: string;
  timestamp: number;
  provider?: string;
}

export default function ChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || analyzing) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAnalyzing(true);

    try {
      const result = await window.electronAPI.captureScreenshot();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Analyzing...",
        screenshot: result || undefined,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (result) {
        const base64 = result.replace("data:image/png;base64,", "");
        const response = await window.electronAPI.analyze(base64, userMsg.text);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  text: response.error || response.response || "No response",
                }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: "Failed to capture screenshot" } : m,
          ),
        );
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
        },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-4 bg-gray-900 rounded-lg">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center text-sm py-8">
            Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+Shift+G</kbd> or type a
            message to analyze a screenshot.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
              }`}
            >
              {msg.screenshot && (
                <img
                  src={msg.screenshot}
                  alt="Screenshot"
                  className="rounded mb-2 max-h-32 object-contain"
                />
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-[10px] opacity-50 mt-1">
                {formatTime(msg.timestamp)}
                {msg.provider && ` · ${msg.provider}`}
              </p>
            </div>
          </div>
        ))}
        {analyzing && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2 text-gray-400 text-sm animate-pulse">
              Analyzing screenshot...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your game..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={analyzing || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
