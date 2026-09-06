import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "./ui/Toast";

type Accelerator = string;

export interface HotkeyRecorderProps {
  value: Accelerator;
  onChange: (value: Accelerator) => void;
  onValidate?: (accelerator: Accelerator) => Promise<{ valid: boolean; conflict?: boolean }>;
  placeholder?: string;
  disabled?: boolean;
}

export default function HotkeyRecorder({
  value,
  onChange,
  onValidate,
  placeholder = "Ctrl+Shift+G",
  disabled = false,
}: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<Accelerator | null>(null);
  const [conflict, setConflict] = useState(false);
  const [validating, setValidating] = useState(false);
  const toast = useToast();
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setPending(null);
        setConflict(false);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.metaKey) parts.push("CommandOrControl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      let key = e.key;
      if (key === " ") key = "Space";

      if (key.length === 1) {
        key = key.toUpperCase();
      }

      parts.push(key);
      const accelerator = parts.join("+");

      setPending(accelerator);
      setConflict(false);

      if (onValidate) {
        setValidating(true);
        onValidate(accelerator)
          .then((result) => {
            setConflict(result.conflict ?? false);
            if (result.conflict) {
              toast.showToast("This shortcut is already in use", "info");
            }
          })
          .catch(() => {
            toast.showToast("Failed to validate shortcut", "error");
          })
          .finally(() => {
            setValidating(false);
          });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending && !conflict && !validating) {
        onChange(pending);
        setRecording(false);
        setPending(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [recording, pending, conflict, validating, onChange, onValidate, toast]);

  const handleClick = () => {
    if (disabled) return;
    setRecording(true);
    setPending(null);
    setConflict(false);
  };

  const displayValue = recording ? pending || "Press keys..." : value || placeholder;

  return (
    <div ref={containerRef} className="flex gap-2 items-center">
      <button
        id={inputId}
        type="button"
        onClick={handleClick}
        disabled={disabled || recording}
        className={`input min-w-[180px] text-left cursor-pointer ${
          recording ? "ring-2 ring-[var(--color-accent)]" : ""
        } ${conflict ? "ring-2 ring-[var(--color-error)]" : ""}`}
        title={recording ? "Press your shortcut, Escape to cancel" : "Click to change shortcut"}
      >
        {displayValue}
        {recording && (
          <span className="ml-2 text-[var(--color-text-tertiary)]">(recording...)</span>
        )}
        {conflict && <span className="ml-2 text-[var(--color-error)]">(conflict)</span>}
      </button>
      {recording && (
        <span className="text-xs text-[var(--color-text-tertiary)]">Press keys or Escape</span>
      )}
    </div>
  );
}
