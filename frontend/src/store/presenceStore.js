import { create } from 'zustand';

const usePresenceStore = create((set) => ({
  onlineUsers: new Set(),

  setOnlineList: (ids) => set({ onlineUsers: new Set(ids) }),

  addOnline: (id) =>
    set((state) => ({ onlineUsers: new Set(state.onlineUsers).add(id) })),

  removeOnline: (id) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(id);
      return { onlineUsers: next };
    }),

  clear: () => set({ onlineUsers: new Set() }),
}));

export default usePresenceStore;