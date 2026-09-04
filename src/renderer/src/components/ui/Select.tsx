import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      className={`w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] transition-colors ${className}`}
      {...props}
    />
  );
}
