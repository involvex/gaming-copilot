import { useEffect, useState } from "react";
import Overlay from "./components/Overlay";
import Settings from "./components/Settings";

function MainWindow() {
  const [status, setStatus] = useState("Ready");
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);

  const handleCapture = async () => {
    setStatus("Capturing screenshot...");
    const result = await window.electronAPI.analyze("", "Analyze this game screenshot.");
    if (result.response) {
      setStatus(result.response);
    } else if (result.error) {
      setStatus(`Error: ${result.error}`);
    }
    const data = await window.electronAPI.captureScreenshot();
    if (data) {
      setLastScreenshot(data);
      setStatus("Screenshot captured! Sending to AI...");
    } else {
      setStatus("Capture failed — no source found");
    }
  };

  useEffect(() => {
    window.electronAPI.onCaptureResult((dataUrl) => {
      setLastScreenshot(dataUrl);
      setStatus("Screenshot captured via hotkey!");
    });
    window.electronAPI.onNavigateSettings(() => {
      window.location.hash = "#/settings";
    });
    return () => {
      window.electronAPI.removeAllListeners("capture:result");
      window.electronAPI.removeAllListeners("navigate:settings");
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Gaming Copilot</h1>
        <button
          type="button"
          onClick={() => (window.location.hash = "#/settings")}
          className="text-gray-400 hover:text-white text-sm"
        >
          Settings
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Quick Capture</h2>
          <p className="text-gray-400 text-sm mb-4">
            Press <kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl+Shift+G</kbd> anywhere to
            capture and analyze your screen.
          </p>
          <button
            type="button"
            onClick={handleCapture}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Capture & Analyze
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Status</h2>
          <p className="text-gray-400 whitespace-pre-wrap">{status}</p>
        </div>

        {lastScreenshot && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Last Screenshot</h2>
            <img src={lastScreenshot} alt="Screenshot" className="rounded-lg max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "#/overlay") return <Overlay />;
  if (route === "#/settings") return <Settings />;
  return <MainWindow />;
}
