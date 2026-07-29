"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore} from "react";

/**
 * `system` follows the phone. `light` / `dark` are an explicit override the
 * user picked in-app, and are the only states we persist — storing a resolved
 * colour for `system` would freeze the app on whatever the phone happened to be
 * set to the first time it was opened.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "payfrens.theme";

/** Fired when this tab changes the preference; `storage` only fires in others. */
const THEME_CHANGE_EVENT = "payfrens:themechange";

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

/* ---------------------------------------------------------------------------
   The theme lives in localStorage and in the OS, not in React. Reading it with
   `useSyncExternalStore` rather than an effect means the very first render
   already has the right value — no post-mount setState, and no flash.
--------------------------------------------------------------------------- */

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);

  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

/**
 * Snapshot as a string so `useSyncExternalStore`'s identity check works without
 * a cache — returning a fresh object each call would loop forever.
 */
function getSnapshot(): string {
  const preference = readStoredPreference();
  const resolved = preference === "system" ? systemTheme() : preference;
  return `${preference}:${resolved}`;
}

/**
 * The server cannot know the phone's setting. It renders dark — matching the
 * `<body>` class and the dark theme-color — and `ThemeScript` has already
 * corrected the DOM by the time this hydrates.
 */
function getServerSnapshot(): string {
  return "system:dark";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private mode can throw on localStorage; following the phone is a fine
    // answer when we cannot remember a choice.
    return "system";
  }
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [preference, theme] = snapshot.split(":") as [ThemePreference, ResolvedTheme];

  // Pushing the class onto <html> is synchronising an external system with
  // React state, which is exactly what an effect is for.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    // Keeps the webview chrome (status bar, overscroll) in step with the app.
    root.style.colorScheme = theme;
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable — the choice still applies for this session.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
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
