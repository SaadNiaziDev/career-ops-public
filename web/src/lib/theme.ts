export type ThemeMode = "system" | "light" | "dark";
export type ContrastMode = "standard" | "medium" | "high";

export { THEME_KEY, CONTRAST_KEY, REDUCE_MOTION_KEY } from "./theme-script";

const THEME_COLORS: Record<"light" | "dark", string> = {
  dark: "#191211",
  light: "#FCEAE2",
};

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem("career-ops:theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function readContrastMode(): ContrastMode {
  if (typeof window === "undefined") return "standard";
  try {
    const v = localStorage.getItem("career-ops:contrast");
    if (v === "standard" || v === "medium" || v === "high") return v;
  } catch {
    /* ignore */
  }
  return "standard";
}

export function readReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("career-ops:reduce-motion") === "true";
  } catch {
    return false;
  }
}

export function applyTheme(
  mode: ThemeMode,
  contrast: ContrastMode = readContrastMode(),
  reduceMotion = readReduceMotion(),
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveDark(mode);
  root.setAttribute("data-theme", mode);
  root.dataset.contrast = contrast;
  root.dataset.reduceMotion = reduceMotion ? "true" : "false";
  root.classList.remove("dark", "light");
  root.classList.add(dark ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[dark ? "dark" : "light"]);
}

export function persistTheme(mode: ThemeMode) {
  try {
    localStorage.setItem("career-ops:theme", mode);
  } catch {
    /* ignore */
  }
  applyTheme(mode);
  window.dispatchEvent(new Event("themechange"));
}

export function persistContrast(contrast: ContrastMode) {
  try {
    localStorage.setItem("career-ops:contrast", contrast);
  } catch {
    /* ignore */
  }
  applyTheme(readThemeMode(), contrast);
  window.dispatchEvent(new Event("themechange"));
}

export function persistReduceMotion(reduceMotion: boolean) {
  try {
    localStorage.setItem("career-ops:reduce-motion", reduceMotion ? "true" : "false");
  } catch {
    /* ignore */
  }
  applyTheme(readThemeMode(), readContrastMode(), reduceMotion);
  window.dispatchEvent(new Event("themechange"));
}
