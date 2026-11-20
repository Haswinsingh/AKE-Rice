import apiRequest from './api';

export const feedbackService = {
  getPublicFeedback: () => apiRequest('/feedback/public'),
  getMyFeedback: () => apiRequest('/feedback/my'),
  createFeedback: (data) => apiRequest('/feedback', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getAdminFeedback: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/feedback/admin${query ? `?${query}` : ''}`);
  },
  moderateFeedback: (id, updateData) => apiRequest(`/feedback/${id}/moderation`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  }),
  deleteFeedback: (id) => apiRequest(`/feedback/${id}`, {
    method: 'DELETE'
  })
};

export default feedbackService;
