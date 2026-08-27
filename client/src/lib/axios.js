import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Enable sending HttpOnly cookies
});

// Attach bearer token on every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rapidaid_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors and auto-refresh token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Normalize error messages from the backend
    const backendMessage = error.response?.data?.message;
    const normalizedError = new Error(backendMessage || 'An error occurred. Please try again.');
    normalizedError.status = error.response?.status;
    normalizedError.response = error.response;

    // Detect 401 Unauthorized and make sure we don't loop indefinitely
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to call the refresh endpoint to obtain a new access token
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (refreshResponse.data?.success && refreshResponse.data?.accessToken) {
          const newAccessToken = refreshResponse.data.accessToken;
          localStorage.setItem('rapidaid_token', newAccessToken);
          
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          processQueue(null, newAccessToken);
          isRefreshing = false;
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear token since refresh failed
        localStorage.removeItem('rapidaid_token');
        
        // Dispatch custom event to let the AuthContext know it needs to log the user out
        window.dispatchEvent(new Event('auth_session_expired'));
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
