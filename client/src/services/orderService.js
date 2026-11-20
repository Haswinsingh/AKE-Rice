import apiRequest from './api';

export const orderService = {
  createOrder: (orderData) => apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData)
  }),
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/orders${query ? `?${query}` : ''}`);
  },
  getOrderById: (id) => apiRequest(`/orders/${id}`),
  updateStatus: (id, status, note) => apiRequest(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, note })
  }),
  verifyPayment: (id, action, remarks) => apiRequest(`/orders/${id}/payment`, {
    method: 'PUT',
    body: JSON.stringify({ action, remarks })
  }),
  deleteOrder: (id, reason) => apiRequest(`/orders/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason })
  }),
  getTrashOrders: () => apiRequest('/orders/trash'),
  restoreOrder: (id) => apiRequest(`/orders/${id}/restore`, {
    method: 'POST'
  }),
  permanentDeleteOrder: (id) => apiRequest(`/orders/${id}/permanent`, {
    method: 'DELETE'
  })
};

export default orderService;
