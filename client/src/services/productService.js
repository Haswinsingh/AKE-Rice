import apiRequest from './api';

export const productService = {
  getProducts: () => apiRequest('/products'),
  getAllProductsAdmin: () => apiRequest('/products/admin/all'),
  getProductById: (id) => apiRequest(`/products/${id}`),
  createProduct: (data) => apiRequest('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => apiRequest(`/products/${id}`, { method: 'DELETE' })
};

export default productService;
