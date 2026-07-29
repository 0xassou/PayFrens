import {THEME_STORAGE_KEY} from "./theme-provider";

/**
 * Runs before first paint so the correct theme is already on <html> when the
 * page renders. Without it the app paints light, then snaps to dark a frame
 * later — very visible inside Base App's sheet.
 *
 * Kept deliberately tiny and dependency-free: it is inlined into the document
 * head and blocks rendering until it finishes.
 */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var dark = stored === 'dark' ||
      (stored !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    // Private mode can throw on localStorage. Falling through leaves the
    // server-rendered default in place, which is a working app.
  }
})();
`.trim();

  return <script dangerouslySetInnerHTML={{__html: script}} suppressHydrationWarning />;
}
