import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mirrordesk-theme';

function readInitialTheme(): AppTheme {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.theme;
    if (current === 'light' || current === 'dark') return current;
  }
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
}

function applyTheme(theme: AppTheme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1120' : '#F5F7FA');
  }
  if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

interface AppState {
  selectedAccountId: string | null;
  selectedConversationId: string | null;
  sidebarCollapsed: boolean;
  theme: AppTheme;
  selectAccount: (id: string | null) => void;
  selectConversation: (id: string | null) => void;
  toggleSidebar: () => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedAccountId: null,
  selectedConversationId: null,
  sidebarCollapsed: false,
  theme: readInitialTheme(),
  selectAccount: (selectedAccountId) => set({ selectedAccountId }),
  selectConversation: (selectedConversationId) => set({ selectedConversationId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => set((state) => {
    const theme: AppTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    return { theme };
  }),
}));
