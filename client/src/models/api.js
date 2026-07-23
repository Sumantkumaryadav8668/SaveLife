import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rapidaid_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors (e.g. unauthorized)
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response || error);
    const message = error.response?.data?.message || 'An error occurred. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  uploadId: (formData) => {
    return apiClient.post('/auth/upload-id', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const sosAPI = {
  trigger: (data) => apiClient.post('/sos/trigger', data), // { latitude, longitude, silent }
  getActive: () => apiClient.get('/sos/active'),
  getHistory: () => apiClient.get('/sos/history'),
  accept: (id, eta) => apiClient.post(`/sos/accept/${id}`, { eta }),
  resolve: (id, rating, comment) => apiClient.post(`/sos/resolve/${id}`, { rating, comment }),
  flagAbuse: (id, comment) => apiClient.post(`/sos/abuse/${id}`, { comment }),
};

export const hospitalAPI = {
  getNearby: () => apiClient.get('/hospitals/nearby'),
  getResources: (id) => apiClient.get(`/hospitals/${id}/resources`),
  updateResources: (id, resources) => apiClient.put(`/hospitals/${id}/resources`, resources),
  bookBed: (id, data) => apiClient.post(`/hospitals/${id}/book-bed`, data),
};

export const chatbotAPI = {
  sendMessage: (message) => apiClient.post('/chatbot/message', { message }),
  escalateTicket: (initialMessage) => apiClient.post('/chatbot/escalate', { initialMessage }),
  getTickets: () => apiClient.get('/chatbot/tickets'),
  resolveTicket: (id) => apiClient.put(`/chatbot/tickets/${id}/resolve`),
};

export const adminAPI = {
  getUsers: () => apiClient.get('/admin/users'),
  getAnalytics: () => apiClient.get('/admin/analytics'),
  getAuditLogs: () => apiClient.get('/admin/audit-logs'),
  updateUserRole: (id, role, entityId) => apiClient.put(`/admin/users/${id}/role`, { role, entityId }),
  updateUserStatus: (id, status, suspensionDurationHours) => 
    apiClient.put(`/admin/users/${id}/status`, { status, suspensionDurationHours }),
  getPendingVerifications: () => apiClient.get('/user/pending-verifications'),
  updateVerificationStatus: (userId, status) => apiClient.put(`/user/verifications/${userId}`, { status }),
};

export default apiClient;
