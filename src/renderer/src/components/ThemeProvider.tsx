import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { AppTheme } from "../../../shared/constants";
import { THEME_CLASS_NAMES } from "../../../shared/constants";

export interface ThemeContextValue {
  theme: AppTheme;
  resolvedTheme: Exclude<AppTheme, "system">;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): Exclude<AppTheme, "system"> {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<Exclude<AppTheme, "system">>("dark");

  const applyTheme = useCallback((t: AppTheme) => {
    const resolved = t === "system" ? resolveSystemTheme() : t;
    setResolvedTheme(resolved);
    const docEl = document.documentElement.classList;
    docEl.remove(...THEME_CLASS_NAMES);
    docEl.add(`theme-${resolved}`);
  });

  useEffect(() => {
    const loadConfig = () => {
      window.electronAPI.getConfig().then((cfg) => {
        const c = cfg as Record<string, unknown>;
        const saved = (c.theme as AppTheme) || "dark";
        setThemeState(saved);
        applyTheme(saved);
      });
    };

    loadConfig();

    const unsubscribe = window.electronAPI.onConfigUpdated(() => {
      loadConfig();
    });

    return unsubscribe;
  }, [applyTheme]);

  useEffect(() => {
    if (theme === "system") {
      const handler = () => {
        applyTheme("system");
      };
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", handler);
      return () => {
        window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", handler);
      };
    }
  }, [theme, applyTheme]);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    await window.electronAPI.setSetting("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
