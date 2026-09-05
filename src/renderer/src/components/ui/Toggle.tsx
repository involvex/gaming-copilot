import type { ButtonHTMLAttributes } from "react";

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, description, id, className = "" }: ToggleProps) {
  return (
    <label htmlFor={id} className="flex items-center justify-between cursor-pointer w-full">
      <div>
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
        {description && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${className} ${
          checked ? "toggle-track-checked" : "toggle-track-unchecked"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
