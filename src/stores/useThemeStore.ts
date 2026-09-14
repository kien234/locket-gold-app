import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
}

export const useThemeStore = create<ThemeState>(() => ({
  isDarkMode: true,
  toggleTheme: () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  },
  toggleDarkMode: () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  },
  setDarkMode: () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  },
}));
