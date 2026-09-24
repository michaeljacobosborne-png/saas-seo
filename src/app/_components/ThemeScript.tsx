// Blocking, render-once script that resolves the active theme BEFORE the
// browser paints, so there is no flash of the wrong theme.
//
// Resolution order: localStorage('theme') > system preference > dark default.
//
// It writes `data-theme` onto <html>. Because React never renders that
// attribute (it is set imperatively here, outside the React tree), there is no
// hydration mismatch — the server always emits markup for the dark default.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}
