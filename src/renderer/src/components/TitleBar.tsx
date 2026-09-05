import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { hash: "#/", label: "Home" },
  { hash: "#/settings", label: "Settings" },
] as const;

function GamepadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" x2="18" y1="6" y2="18" />
      <line x1="18" x2="6" y1="6" y2="18" />
    </svg>
  );
}

/**
 * Custom frameless-window title bar: brand, route nav, and window controls.
 * The bar itself is the drag region (`titlebar-drag`); interactive children
 * opt out with `titlebar-nodrag`. Requires the main window with `frame: false`.
 */
export default function TitleBar() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleBarDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".titlebar-nodrag")) return;
    void window.electronAPI.toggleMaximizeWindow();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: frameless-window drag region, actions duplicated by labeled buttons
    <header className="titlebar titlebar-drag" onDoubleClick={handleBarDoubleClick}>
      <div className="titlebar-brand">
        <GamepadIcon />
        <span>GAMING COPILOT</span>
      </div>
      <nav aria-label="Primary" className="titlebar-nav titlebar-nodrag">
        {NAV_ITEMS.map((item) => {
          const isActive = route === item.hash;
          return (
            <button
              key={item.hash}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                window.location.hash = item.hash;
              }}
              className={`titlebar-nav-item${isActive ? " titlebar-nav-item-active" : ""}`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="titlebar-controls titlebar-nodrag">
        <button
          type="button"
          aria-label="Minimize"
          className="titlebar-control"
          onClick={() => void window.electronAPI.minimizeWindow()}
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          className="titlebar-control"
          onClick={() => void window.electronAPI.toggleMaximizeWindow()}
        >
          <MaximizeIcon />
        </button>
        <button
          type="button"
          aria-label="Close"
          className="titlebar-control titlebar-control-close"
          onClick={() => void window.electronAPI.closeWindow()}
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}
