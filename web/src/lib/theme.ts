// Palette tokens live in styles.css (CSS vars). Here we only flip data-theme by OS preference.
export function initTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
  apply();
  mq.addEventListener('change', apply);
}
