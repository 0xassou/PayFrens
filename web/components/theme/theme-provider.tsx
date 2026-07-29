"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";

/**
 * `system` follows the phone. `light` / `dark` are an explicit override the
 * user picked in-app, and are the only states we persist — storing a resolved
 * colour for `system` would freeze the app on whatever the phone happened to be
 * set to the first time it was opened.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "payfrens.theme";

type ThemeContextValue = {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flip to the opposite of what is currently showing. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // Keeps the webview chrome (status bar, pull-to-refresh) in step with the app.
  root.style.colorScheme = theme;
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  // Matches what `ThemeScript` wrote before hydration, so the first render
  // agrees with the DOM.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = readStoredPreference();
    setPreferenceState(stored);
    setTheme(stored === "system" ? systemTheme() : stored);
  }, []);

  // Only listen while the user is on `system` — an explicit choice should not
  // be overridden when the phone flips to night mode at sunset.
  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setTheme(event.matches ? "dark" : "light");

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setTheme(next === "system" ? systemTheme() : next);

    if (next === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [setPreference, theme]);

  const value = useMemo(
    () => ({preference, theme, setPreference, toggle}),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}
