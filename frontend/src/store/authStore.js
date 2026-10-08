import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { disconnectSocket } from '../services/socket';
import usePresenceStore from './presenceStore';

const useAuthStore = create(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
            logout: () => {
                disconnectSocket();
                usePresenceStore.getState().clear();
                set({ token: null, user: null, isAuthenticated: false });
            },
        }),
        {
            name: 'chatapp-auth',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ token: state.token, user: state.user }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (state.token && state.user) {
                        state.setAuth(state.token, state.user);
                    } else {
                        state.logout();
                    }
                }
            },
        },
    ),
);

export default useAuthStore;