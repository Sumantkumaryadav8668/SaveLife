import apiClient from '../lib/axios.js';

// Re-export the same API surface as models/api.js so nothing breaks
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  uploadId: (formData) => apiClient.post('/auth/upload-id', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const sosAPI = {
  trigger: (data) => apiClient.post('/sos/trigger', data),
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

export const notificationAPI = {
  getAll: () => apiClient.get('/notifications'),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};

export default apiClient;
