import { useEffect, useState } from "react";

export default function Overlay() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    window.electronAPI.onOverlayData((data) => {
      setText(data);
      setVisible(true);
      setTimeout(() => setOpacity(1), 50);
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:data");
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => {
        setVisible(false);
        window.electronAPI.hideOverlay();
      }, 300);
    }, 8000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4 select-none"
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      <div className="w-full max-w-sm bg-black/85 backdrop-blur-sm rounded-lg p-4 shadow-2xl border border-white/10">
        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
