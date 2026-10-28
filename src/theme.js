/* Browser-only appearance preference. No account or network access required. */
(() => {
  'use strict';
  const key = 'emperors.theme';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch (_) {}
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const control = document.getElementById('theme-preference');
    if (control) control.value = preference;
  }
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue) ? event.newValue : 'system';
      apply();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-preference')?.addEventListener('change', event => {
      preference = valid(event.target.value) ? event.target.value : 'system';
      try { localStorage.setItem(key, preference); } catch (_) {}
      apply();
    });
  });
})();
