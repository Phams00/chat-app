import { create } from 'zustand';
import api from '../services/api';
import { getSocket } from '../services/socket';

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'light',
  fontSize: 15,
  wallpaper: 'doodles',
  doodleOpacity: 28,
  enterToSend: true,
  notificationsEnabled: true,
  notificationSound: true,
  messagePreview: true,
  doNotDisturb: false,
  showOnlineStatus: true,
  showReadReceipts: true,
});

function applyPreferences(preferences) {
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.wallpaper = preferences.wallpaper;
  root.style.setProperty('--chat-font-size', `${preferences.fontSize}px`);
  root.style.setProperty('--wallpaper-opacity', String(preferences.doodleOpacity / 100));
}

const usePreferencesStore = create((set) => ({
  preferences: DEFAULT_PREFERENCES,
  isSaving: false,
  resetLocalPreferences: () => {
    applyPreferences(DEFAULT_PREFERENCES);
    set({ preferences: DEFAULT_PREFERENCES, isSaving: false });
  },
  loadPreferences: async () => {
    const { data } = await api.get('/profile/me/preferences');
    const preferences = { ...DEFAULT_PREFERENCES, ...data };
    applyPreferences(preferences);
    set({ preferences });
    return preferences;
  },
  updatePreferences: async (changes) => {
    set({ isSaving: true });
    try {
      const { data } = await api.patch('/profile/me/preferences', changes);
      const preferences = { ...DEFAULT_PREFERENCES, ...data };
      applyPreferences(preferences);
      set({ preferences });
      if (Object.hasOwn(changes, 'showOnlineStatus')) {
        getSocket()?.emit('refresh_presence_visibility');
      }
      return preferences;
    } finally {
      set({ isSaving: false });
    }
  },
}));

export default usePreferencesStore;