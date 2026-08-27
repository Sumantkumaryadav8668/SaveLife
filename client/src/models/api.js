import apiClient from '../lib/axios.js';

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
  reverseGeocode: (lat, lng) => apiClient.get(`/sos/reverse-geocode?lat=${lat}&lng=${lng}`),
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
