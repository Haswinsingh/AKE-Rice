import apiRequest from './api';

export const adminService = {
  getDashboardAnalytics: () => apiRequest('/admin/dashboard'),
  getReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/reports${query ? `?${query}` : ''}`);
  },
  getCustomers: () => apiRequest('/admin/customers'),

  // Inventory Management
  getInventory: () => apiRequest('/admin/inventory'),
  getInventoryTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/inventory/transactions${query ? `?${query}` : ''}`);
  },
  updateInventoryStock: (productId, data) => apiRequest(`/admin/inventory/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Admin Account Management
  getAdminUsers: () => apiRequest('/admin/users'),
  checkAdminMobile: (mobile) => apiRequest(`/admin/users/check-mobile/${encodeURIComponent(mobile)}`),
  promoteCustomerToAdmin: (data) => apiRequest('/admin/users/promote', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  createAdminUser: (userData) => apiRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),
  updateAdminUser: (id, userData) => apiRequest(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData)
  }),
  deleteAdminUser: (id) => apiRequest(`/admin/users/${id}`, {
    method: 'DELETE'
  }),
  updateAdminUserStatus: (id, status) => apiRequest(`/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  }),
  updateAdminUserPermissions: (id, permissions) => apiRequest(`/admin/users/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions })
  }),
  resetAdminPassword: (id, password) => apiRequest(`/admin/users/${id}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ password })
  }),

  // POS offline sales
  createSale: (saleData) => apiRequest('/sales', {
    method: 'POST',
    body: JSON.stringify(saleData)
  }),
  getSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/sales${query ? `?${query}` : ''}`);
  },
  updateSale: (id, data) => apiRequest(`/sales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteSale: (id) => apiRequest(`/sales/${id}`, { method: 'DELETE' }),

  // Staff Management (Standardized /staff endpoints)
  getStaff: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/staff${query ? `?${query}` : ''}`);
  },
  createStaff: (staffData) => apiRequest('/admin/staff', {
    method: 'POST',
    body: JSON.stringify(staffData)
  }),
  updateStaff: (id, staffData) => apiRequest(`/admin/staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify(staffData)
  }),
  toggleStaffStatus: (id, status, sales_pos) => apiRequest(`/admin/staff/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, sales_pos })
  }),
  deleteStaff: (id) => apiRequest(`/admin/staff/${id}`, {
    method: 'DELETE'
  }),
  getStaffSales: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/staff/${id}/sales${query ? `?${query}` : ''}`);
  },
  getStaffReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/staff/reports${query ? `?${query}` : ''}`);
  },
  resetStaffAuth: (id, password) => apiRequest(`/admin/staff/${id}/reset-auth`, {
    method: 'PUT',
    body: JSON.stringify({ password })
  }),

  // POS Staff Management (Backward-compatible aliases)
  getPosStaff: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/pos-staff${query ? `?${query}` : ''}`);
  },
  createPosStaff: (staffData) => apiRequest('/admin/pos-staff', {
    method: 'POST',
    body: JSON.stringify(staffData)
  }),
  updatePosStaff: (id, staffData) => apiRequest(`/admin/pos-staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify(staffData)
  }),
  togglePosStaffStatus: (id, status, sales_pos) => apiRequest(`/admin/pos-staff/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, sales_pos })
  }),
  deletePosStaff: (id) => apiRequest(`/admin/pos-staff/${id}`, {
    method: 'DELETE'
  }),
  resetPosStaffAuth: (id, password) => apiRequest(`/admin/pos-staff/${id}/reset-auth`, {
    method: 'PUT',
    body: JSON.stringify({ password })
  }),

  // POS Reports & Performance
  getPosReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/pos/reports${query ? `?${query}` : ''}`);
  },
  getStaffComparison: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/pos/comparison${query ? `?${query}` : ''}`);
  },
  exportPosReportUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    let rawBase = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || '/api').trim().replace(/\/$/, '');
    if ((rawBase.startsWith('http://') || rawBase.startsWith('https://')) && !rawBase.endsWith('/api')) {
      rawBase += '/api';
    }
    return `${rawBase}/pos/export${query ? `?${query}` : ''}`;
  },

  // File Upload
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/upload', {
      method: 'POST',
      body: formData
    });
  },

  // Google Drive Transaction Backup
  getDriveBackupStatus: () => apiRequest('/admin/drive-backup/status'),
  testDriveConnection: () => apiRequest('/admin/drive-backup/test-connection', { method: 'POST' }),
  syncCurrentMonthDriveBackup: () => apiRequest('/admin/drive-backup/sync-current-month', { method: 'POST' }),
  retryFailedDriveBackups: () => apiRequest('/admin/drive-backup/retry-failed', { method: 'POST' }),
  exportHistoricalDriveBackup: () => apiRequest('/admin/drive-backup/export-historical', { method: 'POST' })
};

export default adminService;
