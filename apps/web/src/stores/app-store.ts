import { create } from 'zustand';

interface AppState {
  selectedAccountId: string | null;
  selectedConversationId: string | null;
  sidebarCollapsed: boolean;
  selectAccount: (id: string | null) => void;
  selectConversation: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedAccountId: null,
  selectedConversationId: null,
  sidebarCollapsed: false,
  selectAccount: (selectedAccountId) => set({ selectedAccountId }),
  selectConversation: (selectedConversationId) => set({ selectedConversationId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
