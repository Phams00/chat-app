import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:3000/api`,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.endsWith('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

export default api;
