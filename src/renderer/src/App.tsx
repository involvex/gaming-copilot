import { useEffect, useState } from "react";
import ChatHistory from "./components/ChatHistory";
import Overlay from "./components/Overlay";
import RegionSelector from "./components/RegionSelector";
import Settings from "./components/Settings";

function MainWindow() {
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [captureRegion, setCaptureRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const handleRegionComplete = async (region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    setCaptureRegion(region);
    await window.electronAPI.setCaptureRegion(region);
    setShowRegionSelector(false);
  };

  const handleRegionClear = async () => {
    setCaptureRegion(null);
    await window.electronAPI.setCaptureRegion(null);
  };

  useEffect(() => {
    window.electronAPI.onNavigateSettings(() => {
      window.location.hash = "#/settings";
    });
    return () => {
      window.electronAPI.removeAllListeners("navigate:settings");
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {showRegionSelector && (
        <RegionSelector
          onComplete={handleRegionComplete}
          onCancel={() => setShowRegionSelector(false)}
        />
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Quick Capture</h2>
            <p className="text-gray-400 text-sm mb-4">
              Press <kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl+Shift+G</kbd> anywhere to
              capture and analyze your screen.
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Capture Region</h2>
            {captureRegion ? (
              <div className="space-y-2">
                <p className="text-green-400 text-sm">
                  Region: {captureRegion.width}×{captureRegion.height} at ({captureRegion.x},{" "}
                  {captureRegion.y})
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegionSelector(true)}
                    className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    Redraw
                  </button>
                  <button
                    type="button"
                    onClick={handleRegionClear}
                    className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    Clear (Full Screen)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Capturing full screen (no region set)</p>
                <button
                  type="button"
                  onClick={() => setShowRegionSelector(true)}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Select Region
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat History */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Chat</h2>
          <ChatHistory />
        </div>
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
