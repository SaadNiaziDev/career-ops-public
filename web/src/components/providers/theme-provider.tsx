"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type ContrastMode,
  type ThemeMode,
  applyTheme,
  persistContrast,
  persistReduceMotion,
  persistTheme,
  readContrastMode,
  readReduceMotion,
  readThemeMode,
  resolveDark,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  contrast: ContrastMode;
  reduceMotion: boolean;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  setContrast: (mode: ContrastMode) => void;
  setReduceMotion: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [contrast, setContrastState] = useState<ContrastMode>("standard");
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const syncFromStorage = useCallback(() => {
    const mode = readThemeMode();
    const c = readContrastMode();
    const r = readReduceMotion();
    setThemeState(mode);
    setContrastState(c);
    setReduceMotionState(r);
    setIsDark(resolveDark(mode));
    applyTheme(mode, c, r);
  }, []);

  useEffect(() => {
    syncFromStorage();

    const onThemeChange = () => syncFromStorage();
    window.addEventListener("themechange", onThemeChange);
    window.addEventListener("storage", onThemeChange);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readThemeMode() === "system") syncFromStorage();
    };
    mq.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      window.removeEventListener("storage", onThemeChange);
      mq.removeEventListener("change", onSystemChange);
    };
  }, [syncFromStorage]);

  const setTheme = useCallback((mode: ThemeMode) => {
    persistTheme(mode);
    setThemeState(mode);
    setIsDark(resolveDark(mode));
  }, []);

  const setContrast = useCallback((mode: ContrastMode) => {
    persistContrast(mode);
    setContrastState(mode);
  }, []);

  const setReduceMotion = useCallback((value: boolean) => {
    persistReduceMotion(value);
    setReduceMotionState(value);
  }, []);

  const value = useMemo(
    () => ({ theme, contrast, reduceMotion, isDark, setTheme, setContrast, setReduceMotion }),
    [theme, contrast, reduceMotion, isDark, setTheme, setContrast, setReduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
