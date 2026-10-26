import { useEffect } from 'react';
import { useSettings } from '@/store/settings';

export function useApplyTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const apply = () => {
      // In "system" mode an embedding host may pin a theme with data-theme on <html>.
      const hostTheme = root.getAttribute('data-theme');
      const systemDark = hostTheme ? hostTheme === 'dark' : mq.matches;
      const dark = theme === 'dark' || (theme === 'system' && systemDark);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0E1220' : '#FAF9F6');
    };
    apply();
    mq.addEventListener('change', apply);
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', apply);
      obs.disconnect();
    };
  }, [theme]);
}
