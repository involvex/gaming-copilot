import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Button } from "./Button";
import { useFocusTrap } from "./useFocusTrap";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "primary",
  });
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions) => {
    setOptions({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel || "Confirm",
      cancelLabel: opts.cancelLabel || "Cancel",
      variant: opts.variant || "primary",
    });
    setOpen(true);
    return new Promise<boolean>((res) => {
      setResolve(() => res);
    });
  };

  const handleClose = (value: boolean) => {
    setOpen(false);
    if (resolve) resolve(value);
  };

  const trap = useFocusTrap<HTMLDivElement>(open, {
    onEscape: () => handleClose(false),
  });

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={options.title || "Confirm"}
          ref={trap.containerRef}
          tabIndex={-1}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose(false);
            }
          }}
          onKeyDown={trap.onKeyDown}
        >
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">{options.title || "Confirm"}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">{options.message}</p>
            <div className="flex gap-2">
              <Button
                variant={options.variant === "danger" ? "danger" : "primary"}
                size="sm"
                onClick={() => handleClose(true)}
                className="flex-1"
              >
                {options.confirmLabel}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleClose(false)}
                className="flex-1"
              >
                {options.cancelLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
