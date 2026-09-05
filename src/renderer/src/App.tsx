import { useEffect, useState } from "react";
import ChatHistory from "./components/ChatHistory";
import Overlay from "./components/Overlay";
import RegionSelector from "./components/RegionSelector";
import Settings from "./components/Settings";
import TitleBar from "./components/TitleBar";
import { Button, Card } from "./components/ui";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { ToastProvider } from "./components/ui/Toast";

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
    const unsubscribe = window.electronAPI.onNavigateSettings(() => {
      window.location.hash = "#/settings";
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <TitleBar />
      {showRegionSelector && (
        <RegionSelector
          onComplete={handleRegionComplete}
          onCancel={() => setShowRegionSelector(false)}
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="layout-grid-2 xl:gap-8">
          {/* Left: Controls */}
          <div className="space-y-4">
            <Card>
              <h2 className="section-heading mb-2">Quick Capture</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Press <kbd className="kbd">Ctrl+Shift+G</kbd> anywhere to capture and analyze your
                screen.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  const result = await window.electronAPI.captureRecord();
                  if (result) {
                    window.location.hash = "#/settings";
                  }
                }}
              >
                Record Screen (Composite)
              </Button>
            </Card>

            <Card>
              <h2 className="section-heading mb-2">Capture Region</h2>
              {captureRegion ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-success)]">
                    Region: {captureRegion.width}\u00d7{captureRegion.height} at ({captureRegion.x},{" "}
                    {captureRegion.y})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRegionSelector(true)}
                    >
                      Redraw
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleRegionClear}>
                      Clear (Full Screen)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    Capturing full screen (no region set)
                  </p>
                  <Button variant="primary" size="sm" onClick={() => setShowRegionSelector(true)}>
                    Select Region
                  </Button>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="section-heading mb-2">Screenshot Gallery</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                Browse, preview, and manage your saved screenshots.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => (window.location.hash = "#/settings")}
              >
                Open Gallery
              </Button>
            </Card>
          </div>

          {/* Right: Chat History */}
          <Card padding="none">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2 className="section-heading">Chat</h2>
            </div>
            <ChatHistory />
          </Card>
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
  return (
    <ConfirmProvider>
      <ToastProvider>
        <MainWindow />
      </ToastProvider>
    </ConfirmProvider>
  );
}
