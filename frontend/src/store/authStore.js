import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { disconnectSocket } from '../services/socket';
import usePresenceStore from './presenceStore';

const authStorage = {
    getItem: (name) => {
        const session = sessionStorage.getItem(name);
        const legacySession = localStorage.getItem(name);

        if (legacySession !== null) localStorage.removeItem(name);
        if (session !== null) return session;

        if (legacySession !== null) {
            sessionStorage.setItem(name, legacySession);
        }
        return legacySession;
    },
    setItem: (name, value) => sessionStorage.setItem(name, value),
    removeItem: (name) => sessionStorage.removeItem(name),
};

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
            storage: createJSONStorage(() => authStorage),
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