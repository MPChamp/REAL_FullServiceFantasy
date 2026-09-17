import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// A module-level store, not per-component state. Seven components read the
// theme — charts pass `isDark` into Recharts tooltip colors — and with local
// useState only the toggle itself re-rendered, so every chart kept the old
// theme's colors until you navigated away and back.
let theme: Theme = readTheme();
const listeners = new Set<() => void>();

function apply(next: Theme) {
  theme = next;
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Private browsing or blocked storage: the class is still applied.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => theme;

// index.html sets the class before paint to avoid a flash; keep the DOM in
// sync with the store for the case where they disagree.
apply(theme);

export function useTheme() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as Theme);

  return {
    theme: current,
    toggleTheme: () => apply(current === 'dark' ? 'light' : 'dark'),
    isDark: current === 'dark',
  } as const;
}
