import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  BarChart3, ShoppingBag, FileText, Users, UserCheck, FileSpreadsheet, TrendingUp, Award,
  MessageSquare, DollarSign, CheckCircle2, XCircle, 
  Clock, Shield, ShieldAlert, Eye, ZoomIn, Copy, Download, 
  Printer, Plus, Trash2, Filter, RefreshCw, Send, Search, ExternalLink,
  Package, Edit2, Check, X, Boxes, AlertTriangle, Key, UserPlus, Lock, Layers, History as HistoryIcon,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminService';
import { orderService } from '../services/orderService';
import { feedbackService } from '../services/feedbackService';
import { productService } from '../services/productService';
import { useToast } from '../context/ToastContext';
import LightboxModal from '../components/LightboxModal';

function normalizeIndianMobile(input) {
  if (!input) return '';
  let cleaned = input.toString().trim().replace(/\D/g, '');
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length > 10 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(-10);
  }
  return cleaned;
}

function formatProductImage(img) {
  if (!img) return '/assets/packet_1kg.jpg';
  const str = String(img).trim();
  if (!str) return '/assets/packet_1kg.jpg';
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }
  return `/${str}`;
}

const PERMISSION_LIST = [
  { key: 'analytics', label: 'Analytics Overview', desc: 'View store revenue, sales breakdown, conversion rates, and dashboard graphs.' },
  { key: 'inventory', label: 'Inventory Management', desc: 'Manage rice/paddy warehouse stock, monitor batch inventory, and record manual stock adjustments.' },
  { key: 'products', label: 'Product Management', desc: 'Add new rice packages, update pricing, change descriptions, and upload product photos.' },
  { key: 'sales_pos', label: 'Sales Entry / POS', desc: 'Access offline retail billing (1 KG @ ₹195/kg) and wholesale bulk bag sales (25 KG @ ₹185/kg) with automatic stock deduction.' },
  { key: 'pos_staff_management', label: 'Staff Management', desc: 'Add staff accounts, manage credentials, assign POS permissions, and monitor staff performance.' },
  { key: 'pos_reports', label: 'POS Reports & Metrics', desc: 'View individual POS staff sales reports, date-filtered metrics, and transaction ledgers.' },
  { key: 'pos_reports_all_staff', label: 'All Staff Comparison', desc: 'Access comprehensive multi-staff performance comparison, rankings, and CSV export.' },
  { key: 'reports', label: 'Business Reports', desc: 'Generate date-filtered sales reports, area revenue statements, and export Excel/CSV reports.' },
  { key: 'orders', label: 'Store & WhatsApp Orders', desc: 'Process incoming online store and WhatsApp orders, verify payment screenshots, and update delivery statuses.' },
  { key: 'customers', label: 'Customer Management', desc: 'Access customer registry, purchase history, delivery addresses, and contact details.' },
  { key: 'feedback', label: 'Feedback Management', desc: 'Moderate customer reviews, approve testimonials for public display, and write management replies.' },
  { key: 'admin_management', label: 'Admin Management', desc: 'View administrator roster, promote customer accounts to admin, and review access logs.' },
  { key: 'settings', label: 'Settings', desc: 'Review mill store operating hours, contact configurations, and delivery fee settings.' }
];

const ALL_NAV_PANELS = [
  { id: 'analytics', name: 'Analytics Overview', icon: BarChart3, permission: 'analytics' },
  { id: 'inventory', name: 'Inventory Management', icon: Boxes, permission: 'inventory' },
  { id: 'products', name: 'Product Management', icon: Package, permission: 'products' },
  { id: 'sales-entry', name: 'Sales Entry / POS', icon: DollarSign, permission: 'sales_pos' },
  { id: 'pos-staff', name: 'Staff Management', icon: UserCheck, permission: 'pos_staff_management' },
  { id: 'pos-reports', name: 'POS Reports & Comparison', icon: FileSpreadsheet, permission: 'pos_reports' },
  { id: 'reports', name: 'Business Reports', icon: FileText, permission: 'reports' },
  { id: 'orders', name: 'Store & WhatsApp Orders', icon: ShoppingBag, permission: 'orders' },
  { id: 'customers', name: 'Customer Management', icon: Users, permission: 'customers' },
  { id: 'feedback', name: 'Feedback Management', icon: MessageSquare, permission: 'feedback' },
  { id: 'admin-users', name: 'Admin Management', icon: Shield, permission: 'admin_management' },
  { id: 'settings', name: 'Settings', icon: Settings, permission: 'settings' }
];

export default function AdminPage({ initialPanel }) {
  const { user, isAdmin, isSuperAdmin, hasPermission, refreshUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const queryPanel = initialPanel || searchParams.get('panel') || searchParams.get('tab');
  const [activePanel, setActivePanel] = useState(queryPanel || 'analytics');
  const [lightboxImg, setLightboxImg] = useState(null);

  // Granular Permission Management Modal State
  const [permissionModal, setPermissionModal] = useState(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // 1. Analytics Data
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // 2. POS Sales Entry Form State
  const [posProduct, setPosProduct] = useState('1 KG Rice'); // '1 KG Rice' or '25 KG Rice'
  const [posShop, setPosShop] = useState('');
  const [posArea, setPosArea] = useState('');
  const [posDate, setPosDate] = useState(new Date().toISOString().split('T')[0]);
  const [posQty, setPosQty] = useState(1);
  const [posRate, setPosRate] = useState(195);
  const [posPayment, setPosPayment] = useState('Cash');
  const [posSalesperson, setPosSalesperson] = useState(user?.name || 'Kavin');
  const [posStatus, setPosStatus] = useState('Delivered');
  const [posScreenshot, setPosScreenshot] = useState('');
  const [recentSales, setRecentSales] = useState([]);

  // 3. Reports State
  const [reportRows, setReportRows] = useState([]);
  const [reportPeriod, setReportPeriod] = useState('all');
  const [reportArea, setReportArea] = useState('all');
  const [reportPayment, setReportPayment] = useState('all');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportProduct, setReportProduct] = useState('all');
  const [reportRevenue, setReportRevenue] = useState(0);

  // 4. WhatsApp & Store Orders State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentVerifyModal, setPaymentVerifyModal] = useState(null); // { order, action: 'verify'|'reject' }
  const [verifyRemarks, setVerifyRemarks] = useState('');

  // 5. Customer Registry State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState(null);

  // 6. Product Management State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModal, setProductModal] = useState(null); // { mode: 'create'|'edit', product: {...} }
  const [productForm, setProductForm] = useState({
    name: '',
    tamilName: 'கொப்பம்பட்டி சீரக சம்பா அரிசி',
    description: '',
    category: 'Seeraga Samba',
    packageSize: '1 KG Pouch',
    unitWeightKg: 1,
    price: 195,
    ratePerKg: 195,
    stock: 500,
    status: 'Active',
    displayOrder: 1,
    image: 'assets/packet_1kg.jpg'
  });
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  // 7. Feedback Moderation State
  const [adminFeedback, setAdminFeedback] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');

  // 8. Inventory Management State
  const [inventorySummary, setInventorySummary] = useState(null);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null); // selected product for adjustment
  const [adjustForm, setAdjustForm] = useState({
    initialStockKg: '',
    addStockKg: '',
    setAvailableStockKg: '',
    lowStockThresholdKg: 200,
    note: ''
  });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // 9. Admin Account Management State
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [createAdminModal, setCreateAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    username: '',
    email: '',
    mobile: '',
    password: ''
  });
  const [createAdminSubmitting, setCreateAdminSubmitting] = useState(false);
  const [mobileCheckResult, setMobileCheckResult] = useState(null);
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [editAdminModal, setEditAdminModal] = useState(null);
  const [editAdminForm, setEditAdminForm] = useState({ name: '', mobile: '', email: '', username: '', status: 'Active' });
  const [editAdminSubmitting, setEditAdminSubmitting] = useState(false);
  const [resetPassModal, setResetPassModal] = useState(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [resetPassSubmitting, setResetPassSubmitting] = useState(false);

  // 10. Staff Management State
  const [posStaffList, setPosStaffList] = useState([]);
  const [loadingPosStaff, setLoadingPosStaff] = useState(false);
  const [posStaffSearch, setPosStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all');
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [createStaffModal, setCreateStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    mobile: '',
    email: '',
    username: '',
    staffId: '',
    password: '',
    status: 'Active',
    sales_pos: true,
    view_own_sales: true,
    view_customer_info: false
  });
  const [createStaffSubmitting, setCreateStaffSubmitting] = useState(false);
  const [editStaffModal, setEditStaffModal] = useState(null);
  const [editStaffSubmitting, setEditStaffSubmitting] = useState(false);
  const [resetStaffPassModal, setResetStaffPassModal] = useState(null);
  const [resetStaffPassValue, setResetStaffPassValue] = useState('');
  const [resetStaffPassSubmitting, setResetStaffPassSubmitting] = useState(false);
  const [deleteStaffConfirmModal, setDeleteStaffConfirmModal] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // 11. POS Reports & Staff Comparison State
  const [activeReportTab, setActiveReportTab] = useState('reports'); // 'reports' | 'comparison'
  const [posReportsData, setPosReportsData] = useState({
    summary: {
      totalSales: 0,
      totalQuantityKg: 0,
      transactionCount: 0,
      avgTransactionValue: 0,
      cashSales: 0,
      upiSales: 0
    },
    transactions: []
  });
  const [loadingPosReports, setLoadingPosReports] = useState(false);
  const [selectedReportStaff, setSelectedReportStaff] = useState('all');
  const [reportPeriodFilter, setReportPeriodFilter] = useState('today');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportPaymentFilter, setReportPaymentFilter] = useState('all');
  const [reportAreaFilter, setReportAreaFilter] = useState('all');

  const [comparisonData, setComparisonData] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonSortBy, setComparisonSortBy] = useState('sales');
  const [comparisonPeriod, setComparisonPeriod] = useState('month');

  // Guard: Admin role required (strictly redirect pos_staff directly to /pos)
  useEffect(() => {
    if (!authLoading) {
      if (user?.role === 'pos_staff') {
        navigate('/pos');
        return;
      }
      if (!isAdmin) {
        showToast('Administrator privileges required.', 'error');
        navigate('/login?redirect=/admin');
      }
    }
  }, [authLoading, isAdmin, user, navigate]);

  // Helper to verify if a panel is permitted for current user
  const isPanelAuthorized = (panelId) => {
    if (isSuperAdmin) return true;
    const panelObj = ALL_NAV_PANELS.find(p => p.id === panelId);
    if (!panelObj) return true;
    return hasPermission(panelObj.permission);
  };

  // Sync activePanel with URL query parameters (e.g. from profile dropdown or direct navigation)
  useEffect(() => {
    const qPanel = initialPanel || searchParams.get('panel') || searchParams.get('tab');
    if (qPanel && isPanelAuthorized(qPanel)) {
      setActivePanel(qPanel);
    } else if (location.pathname === '/admin' && !qPanel && !initialPanel) {
      setActivePanel('analytics');
    }
  }, [searchParams, initialPanel, location.pathname, location.search]);

  // Dynamic navigation generated based on user permissions
  const navPanels = useMemo(() => {
    return ALL_NAV_PANELS.filter(p => {
      if (isSuperAdmin) return true;
      return hasPermission(p.permission);
    });
  }, [isSuperAdmin, user?.permissions]);

  // Load data for active panel only if permitted
  useEffect(() => {
    if (isAdmin && isPanelAuthorized(activePanel)) {
      if (activePanel === 'analytics') loadAnalytics();
      if (activePanel === 'products') loadAdminProducts();
      if (activePanel === 'sales-entry') loadRecentSales();
      if (activePanel === 'pos-staff') loadPosStaff();
      if (activePanel === 'pos-reports') {
        loadPosReports();
        loadComparison();
        loadPosStaff();
      }
      if (activePanel === 'reports') loadReports();
      if (activePanel === 'orders') loadOrders();
      if (activePanel === 'customers') loadCustomers();
      if (activePanel === 'feedback') loadFeedback();
      if (activePanel === 'inventory') loadInventory();
      if (activePanel === 'admin-users') loadAdminUsers();
    }
  }, [isAdmin, activePanel, isSuperAdmin, user?.permissions]);

  // Reactive reload on POS Reports filter adjustments
  useEffect(() => {
    if (isAdmin && activePanel === 'pos-reports') {
      loadPosReports();
    }
  }, [selectedReportStaff, reportPeriodFilter, reportStartDate, reportEndDate, reportPaymentFilter, reportAreaFilter]);

  // Reactive reload on POS Comparison adjustments
  useEffect(() => {
    if (isAdmin && activePanel === 'pos-reports' && activeReportTab === 'comparison') {
      loadComparison();
    }
  }, [comparisonPeriod, comparisonSortBy, activeReportTab]);

  // Reactive reload on Staff status filter changes
  useEffect(() => {
    if (isAdmin && activePanel === 'pos-staff') {
      loadPosStaff();
    }
  }, [staffStatusFilter]);

  const loadAnalytics = () => {
    setLoadingAnalytics(true);
    adminService.getDashboardAnalytics()
      .then(res => {
        if (res.success) setAnalytics(res.metrics);
      })
      .catch(() => showToast('Failed to load analytics', 'error'))
      .finally(() => setLoadingAnalytics(false));
  };

  const loadRecentSales = () => {
    adminService.getSales()
      .then(res => {
        if (res.success) setRecentSales(res.sales || []);
      })
      .catch(() => {});
  };

  const loadReports = () => {
    const params = {
      period: reportPeriod,
      area: reportArea,
      payment: reportPayment,
      deliveryStatus: reportStatus,
      product: reportProduct
    };
    adminService.getReports(params)
      .then(res => {
        if (res.success) {
          setReportRows(res.reportRows || []);
          setReportRevenue(res.totalRevenue || 0);
        }
      })
      .catch(() => showToast('Failed to generate reports', 'error'));
  };

  const loadOrders = () => {
    const params = {
      search: orderSearch,
      status: orderStatusFilter
    };
    orderService.getOrders(params)
      .then(res => {
        if (res.success) setOrders(res.orders || []);
      })
      .catch(() => showToast('Failed to load orders', 'error'));
  };

  const loadCustomers = () => {
    adminService.getCustomers()
      .then(res => {
        if (res.success) setCustomers(res.registry || []);
      })
      .catch(() => {});
  };

  const loadAdminProducts = () => {
    setLoadingProducts(true);
    productService.getAllProductsAdmin()
      .then(res => {
        if (res.success) setProducts(res.products || []);
      })
      .catch(() => showToast('Failed to load products', 'error'))
      .finally(() => setLoadingProducts(false));
  };

  const loadFeedback = () => {
    feedbackService.getAdminFeedback({ status: feedbackFilter })
      .then(res => {
        if (res.success) setAdminFeedback(res.reviews || []);
      })
      .catch(() => {});
  };

  // Submit POS Sale
  const handlePosSubmit = async (e) => {
    e.preventDefault();
    if (!posShop.trim() || !posArea.trim()) {
      showToast('Please enter shop name and area.', 'error');
      return;
    }

    try {
      const payload = {
        product: posProduct,
        shop: posShop.trim(),
        area: posArea.trim(),
        date: posDate,
        qty: posQty,
        rate: posRate,
        payment: posPayment,
        salesperson: posSalesperson,
        status: posStatus,
        screenshot: posScreenshot || undefined
      };

      const res = await adminService.createSale(payload);
      if (res.success) {
        showToast(res.message, 'success');
        setPosShop('');
        setPosArea('');
        setPosQty(1);
        setPosScreenshot('');
        loadRecentSales();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record sale', 'error');
    }
  };

  // POS rate update helper
  const handlePosProductChange = (prod) => {
    setPosProduct(prod);
    if (prod === '25 KG Rice') {
      setPosRate(185);
    } else {
      setPosRate(195);
    }
  };

  const posTotal = posProduct === '25 KG Rice' 
    ? posQty * 25 * posRate 
    : posQty * posRate;

  // Verify or reject payment
  const handlePaymentAction = async () => {
    if (!paymentVerifyModal) return;
    try {
      const res = await orderService.verifyPayment(
        paymentVerifyModal.order.id,
        paymentVerifyModal.action,
        verifyRemarks
      );
      if (res.success) {
        showToast(res.message, 'success');
        setPaymentVerifyModal(null);
        setVerifyRemarks('');
        loadOrders();
      }
    } catch (err) {
      showToast('Payment update failed', 'error');
    }
  };

  // Update order delivery status
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await orderService.updateStatus(orderId, newStatus);
      if (res.success) {
        showToast(`Order status updated to ${newStatus}`, 'success');
        loadOrders();
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  // Product Management Handlers
  const handleOpenProductModal = (product = null) => {
    if (product) {
      setProductModal({ mode: 'edit', product });
      setProductForm({
        id: product.id,
        name: product.name || '',
        tamilName: product.tamilName || '',
        description: product.description || '',
        category: product.category || 'Seeraga Samba',
        packageSize: product.packageSize || '',
        unitWeightKg: product.unitWeightKg || 1,
        price: product.price || 195,
        ratePerKg: product.ratePerKg || 195,
        stock: product.stock !== undefined ? product.stock : 500,
        status: product.status || (product.isAvailable ? 'Active' : 'Inactive'),
        displayOrder: product.displayOrder || 1,
        image: product.image || 'assets/packet_1kg.jpg'
      });
    } else {
      setProductModal({ mode: 'create', product: null });
      setProductForm({
        name: '',
        tamilName: 'கொப்பம்பட்டி சீரக சம்பா அரிசி',
        description: '',
        category: 'Seeraga Samba',
        packageSize: '1 KG Pouch',
        unitWeightKg: 1,
        price: 195,
        ratePerKg: 195,
        stock: 500,
        status: 'Active',
        displayOrder: products.length + 1,
        image: 'assets/packet_1kg.jpg'
      });
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingProductImg(true);
      const res = await adminService.uploadFile(file);
      if (res.success && res.fileUrl) {
        setProductForm(prev => ({ ...prev, image: res.fileUrl }));
        showToast('Product image uploaded successfully!', 'success');
      }
    } catch (err) {
      showToast('Image upload failed', 'error');
    } finally {
      setUploadingProductImg(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price) {
      showToast('Product name and price are required', 'error');
      return;
    }
    try {
      if (productModal?.mode === 'create') {
        const res = await productService.createProduct(productForm);
        if (res.success) {
          showToast('New product created successfully!', 'success');
          setProductModal(null);
          loadAdminProducts();
        }
      } else if (productModal?.mode === 'edit') {
        const res = await productService.updateProduct(productModal.product.id, productForm);
        if (res.success) {
          showToast('Product updated successfully!', 'success');
          setProductModal(null);
          loadAdminProducts();
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
    }
  };

  const handleToggleProductStatus = async (prod) => {
    const nextStatus = prod.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await productService.updateProduct(prod.id, {
        status: nextStatus,
        isAvailable: nextStatus === 'Active'
      });
      if (res.success) {
        showToast(`Product set to ${nextStatus}`, 'success');
        loadAdminProducts();
      }
    } catch (err) {
      showToast('Could not update product status', 'error');
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Are you sure you want to delete "${prod.name}"?`)) return;
    try {
      const res = await productService.deleteProduct(prod.id);
      if (res.success) {
        showToast('Product deleted successfully', 'success');
        loadAdminProducts();
      }
    } catch (err) {
      showToast('Failed to delete product', 'error');
    }
  };

  // Moderate feedback
  const handleModerateFeedback = async (id, action, adminResponse = null) => {
    try {
      const res = await feedbackService.moderateFeedback(id, { action, adminResponse });
      if (res.success) {
        showToast(res.message, 'success');
        setReplyModal(null);
        setReplyText('');
        loadFeedback();
      }
    } catch (err) {
      showToast('Moderation action failed', 'error');
    }
  };

  // Export CSV
  const exportReportsCSV = () => {
    if (reportRows.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = ['ID', 'Source', 'Date', 'Customer/Shop', 'Mobile', 'Area', 'Product', 'Quantity', 'Rate', 'Total', 'Payment', 'Payment Status', 'Delivery Status', 'Salesperson'];
    const rows = reportRows.map(r => [
      r.id,
      r.source,
      r.date,
      `"${r.customer}"`,
      r.mobile,
      `"${r.area}"`,
      `"${r.product}"`,
      r.qty,
      r.rate,
      r.total,
      r.payment,
      r.paymentStatus,
      r.status,
      r.salesperson
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AKE_Rice_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report CSV downloaded!', 'success');
  };

  // Load Inventory Data
  const loadInventory = () => {
    setLoadingInventory(true);
    Promise.all([
      adminService.getInventory(),
      adminService.getInventoryTransactions()
    ])
      .then(([invRes, txnRes]) => {
        if (invRes && invRes.success) {
          setInventorySummary(invRes.summary);
          setInventoryProducts(invRes.products || []);
        }
        if (txnRes && txnRes.success) {
          setInventoryTransactions(txnRes.transactions || []);
        }
      })
      .catch(() => showToast('Failed to load inventory data', 'error'))
      .finally(() => setLoadingInventory(false));
  };

  const handleOpenAdjustModal = (product) => {
    setAdjustModal(product);
    setAdjustForm({
      initialStockKg: product.initialStockKg || 5000,
      addStockKg: '',
      setAvailableStockKg: product.availableStockKg !== undefined ? product.availableStockKg : 5000,
      lowStockThresholdKg: product.lowStockThresholdKg || 200,
      note: ''
    });
  };

  const handleSubmitAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustModal) return;

    try {
      setAdjustSubmitting(true);
      const payload = {
        lowStockThresholdKg: Number(adjustForm.lowStockThresholdKg) || 200,
        note: adjustForm.note ? adjustForm.note.trim() : 'Admin stock adjustment'
      };

      if (adjustForm.addStockKg && Number(adjustForm.addStockKg) > 0) {
        payload.addStockKg = Number(adjustForm.addStockKg);
      } else if (adjustForm.initialStockKg !== '' && Number(adjustForm.initialStockKg) !== adjustModal.initialStockKg) {
        payload.initialStockKg = Number(adjustForm.initialStockKg);
      } else if (adjustForm.setAvailableStockKg !== '') {
        payload.setAvailableStockKg = Number(adjustForm.setAvailableStockKg);
      }

      const res = await adminService.updateInventoryStock(adjustModal.id, payload);
      if (res.success) {
        showToast(`Stock updated for ${adjustModal.name}`, 'success');
        setAdjustModal(null);
        loadInventory();
        loadAdminProducts();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update stock', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Load Admin Users
  const loadAdminUsers = () => {
    setLoadingAdmins(true);
    adminService.getAdminUsers()
      .then(res => {
        if (res && res.success) {
          setAdminUsers(res.users || []);
        }
      })
      .catch(() => showToast('Failed to load administrator accounts', 'error'))
      .finally(() => setLoadingAdmins(false));
  };

  const handleMobileInputChange = (e) => {
    const rawVal = e.target.value;
    const clean = normalizeIndianMobile(rawVal);
    setNewAdminForm(prev => ({ ...prev, mobile: clean }));

    if (clean.length === 10) {
      checkMobileAvailability(clean);
    } else {
      setMobileCheckResult(null);
      setShowPromoteConfirm(false);
    }
  };

  const checkMobileAvailability = async (cleanMobile) => {
    if (!cleanMobile || cleanMobile.length !== 10) return;
    setCheckingMobile(true);
    try {
      const res = await adminService.checkAdminMobile(cleanMobile);
      setMobileCheckResult(res);
      if (res && res.canPromote && res.user) {
        setNewAdminForm(prev => ({
          ...prev,
          name: prev.name.trim() ? prev.name : (res.user.name || ''),
          email: prev.email.trim() ? prev.email : (res.user.email || '')
        }));
      }
    } catch (err) {
      console.error('[AdminPage] checkMobile error:', err);
    } finally {
      setCheckingMobile(false);
    }
  };

  const handleConfirmPromotion = async () => {
    const cleanMobile = normalizeIndianMobile(newAdminForm.mobile);
    if (!cleanMobile || cleanMobile.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    try {
      setCreateAdminSubmitting(true);
      const res = await adminService.promoteCustomerToAdmin({
        mobile: cleanMobile,
        name: newAdminForm.name.trim() || mobileCheckResult?.user?.name,
        email: newAdminForm.email.trim() || mobileCheckResult?.user?.email
      });
      if (res.success) {
        showToast(res.message, 'success');
        setCreateAdminModal(false);
        setMobileCheckResult(null);
        setShowPromoteConfirm(false);
        setNewAdminForm({ name: '', username: '', email: '', mobile: '', password: '' });
        loadAdminUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to promote customer to administrator', 'error');
    } finally {
      setCreateAdminSubmitting(false);
    }
  };

  const handleCreateAdmin = async (e, forcePromote = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newAdminForm.name.trim() || !newAdminForm.mobile.trim()) {
      showToast('Administrator Name and 10-digit Mobile number are required', 'error');
      return;
    }
    const cleanMobile = normalizeIndianMobile(newAdminForm.mobile);
    if (cleanMobile.length !== 10) {
      showToast('Please enter a valid 10-digit Indian mobile number for SMS OTP login', 'error');
      return;
    }

    if (mobileCheckResult?.isSuperAdmin) {
      showToast('This mobile number belongs to the Super Admin account and cannot be modified.', 'error');
      return;
    }

    if (mobileCheckResult?.exists && mobileCheckResult.role === 'admin' && !mobileCheckResult.canPromote) {
      showToast('This mobile number is already registered as an Admin.', 'error');
      return;
    }

    if (mobileCheckResult?.canPromote && !forcePromote) {
      return handleConfirmPromotion();
    }

    try {
      setCreateAdminSubmitting(true);
      const res = await adminService.createAdminUser({
        ...newAdminForm,
        name: newAdminForm.name.trim(),
        mobile: cleanMobile,
        promote: Boolean(forcePromote || mobileCheckResult?.canPromote)
      });
      if (res.success) {
        showToast(res.message, 'success');
        setCreateAdminModal(false);
        setMobileCheckResult(null);
        setShowPromoteConfirm(false);
        setNewAdminForm({ name: '', username: '', email: '', mobile: '', password: '' });
        loadAdminUsers();
      }
    } catch (err) {
      if (err.data && err.data.canPromote) {
        setMobileCheckResult({
          exists: true,
          canPromote: true,
          role: 'customer',
          user: err.data.existingUser,
          message: err.data.message
        });
        if (err.data.existingUser?.name && !newAdminForm.name.trim()) {
          setNewAdminForm(prev => ({ ...prev, name: err.data.existingUser.name }));
        }
      } else {
        showToast(err.message || 'Failed to create administrator account', 'error');
      }
    } finally {
      setCreateAdminSubmitting(false);
    }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    if (!editAdminModal) return;
    if (!editAdminForm.name.trim() || !editAdminForm.mobile.trim()) {
      showToast('Name and mobile number are required', 'error');
      return;
    }
    const cleanMobile = normalizeIndianMobile(editAdminForm.mobile);
    if (cleanMobile.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    try {
      setEditAdminSubmitting(true);
      const res = await adminService.updateAdminUser(editAdminModal._id || editAdminModal.id, {
        ...editAdminForm,
        mobile: cleanMobile
      });
      if (res.success) {
        showToast(res.message, 'success');
        setEditAdminModal(null);
        loadAdminUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update administrator account', 'error');
    } finally {
      setEditAdminSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (targetAdmin) => {
    if (['Kavin', 'Ashok Kumar'].includes(targetAdmin.name) || targetAdmin.mobile === '8489107668') {
      showToast('Primary founder accounts cannot be deleted.', 'error');
      return;
    }
    const isSelf = user?._id && (user._id.toString() === (targetAdmin._id || targetAdmin.id).toString());
    if (isSelf) {
      showToast('You cannot delete your own administrator account.', 'error');
      return;
    }
    if (!window.confirm(`Permanently delete administrator account "${targetAdmin.name}" (+91 ${targetAdmin.mobile})? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await adminService.deleteAdminUser(targetAdmin._id || targetAdmin.id);
      if (res.success) {
        showToast(res.message, 'success');
        loadAdminUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete administrator account', 'error');
    }
  };

  const handleToggleAdminStatus = async (targetAdmin) => {
    const nextStatus = targetAdmin.status === 'Active' ? 'Disabled' : 'Active';
    const confirmMsg = nextStatus === 'Disabled' 
      ? `Are you sure you want to disable admin account "${targetAdmin.name}"? They will lose access immediately.` 
      : `Enable admin account "${targetAdmin.name}"?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await adminService.updateAdminUserStatus(targetAdmin._id, nextStatus);
      if (res.success) {
        showToast(res.message, 'success');
        loadAdminUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update administrator status', 'error');
    }
  };

  const handleResetAdminPassword = async (e) => {
    e.preventDefault();
    if (!resetPassModal || !resetPassValue) return;
    if (resetPassValue.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    try {
      setResetPassSubmitting(true);
      const res = await adminService.resetAdminPassword(resetPassModal._id, resetPassValue);
      if (res.success) {
        showToast(res.message, 'success');
        setResetPassModal(null);
        setResetPassValue('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setResetPassSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Staff Management Handlers
  // ---------------------------------------------------------------------------
  const loadPosStaff = (statusOverride) => {
    setLoadingPosStaff(true);
    const filterStatus = statusOverride !== undefined ? statusOverride : (staffStatusFilter === 'all' ? undefined : staffStatusFilter);
    adminService.getStaff({ search: posStaffSearch, status: filterStatus })
      .then(res => {
        if (res && res.success) {
          setPosStaffList(res.staff || []);
        }
      })
      .catch(() => showToast('Failed to load staff roster', 'error'))
      .finally(() => setLoadingPosStaff(false));
  };

  const handleCreateStaff = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newStaffForm.name.trim() || !newStaffForm.mobile.trim()) {
      showToast('Staff Name and Mobile number are required', 'error');
      return;
    }
    const cleanMobile = normalizeIndianMobile(newStaffForm.mobile);
    if (cleanMobile.length !== 10) {
      showToast('Please enter a valid 10-digit Indian mobile number', 'error');
      return;
    }
    if (newStaffForm.password && newStaffForm.password.length < 6) {
      showToast('Staff password/PIN must be at least 6 characters', 'error');
      return;
    }

    try {
      setCreateStaffSubmitting(true);
      const res = await adminService.createStaff({
        name: newStaffForm.name.trim(),
        mobile: cleanMobile,
        email: newStaffForm.email?.trim() || undefined,
        username: newStaffForm.username?.trim() || undefined,
        staffId: newStaffForm.staffId?.trim() || undefined,
        password: newStaffForm.password,
        status: newStaffForm.status || 'Active',
        permissions: {
          sales_pos: newStaffForm.sales_pos !== false,
          view_own_sales: newStaffForm.view_own_sales !== false,
          view_customer_info: newStaffForm.view_customer_info === true
        }
      });
      if (res && res.success) {
        showToast(res.message || 'Staff account created successfully', 'success');
        setCreateStaffModal(false);
        setNewStaffForm({
          name: '',
          mobile: '',
          email: '',
          username: '',
          staffId: '',
          password: '',
          status: 'Active',
          sales_pos: true,
          view_own_sales: true,
          view_customer_info: false
        });
        loadPosStaff();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create staff account', 'error');
    } finally {
      setCreateStaffSubmitting(false);
    }
  };

  const handleUpdateStaff = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editStaffModal) return;
    try {
      setEditStaffSubmitting(true);
      const cleanMobile = normalizeIndianMobile(editStaffModal.mobile);
      const res = await adminService.updateStaff(editStaffModal._id, {
        name: editStaffModal.name?.trim(),
        mobile: cleanMobile,
        email: editStaffModal.email?.trim() || undefined,
        username: editStaffModal.username?.trim() || undefined,
        staffId: editStaffModal.staffId?.trim() || undefined,
        status: editStaffModal.status || 'Active',
        permissions: {
          sales_pos: editStaffModal.sales_pos !== false,
          view_own_sales: editStaffModal.view_own_sales !== false,
          view_customer_info: editStaffModal.view_customer_info === true
        }
      });
      if (res && res.success) {
        showToast(res.message || 'Staff member updated successfully', 'success');
        setEditStaffModal(null);
        loadPosStaff();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update staff member', 'error');
    } finally {
      setEditStaffSubmitting(false);
    }
  };

  const handleToggleStaffStatus = async (staff) => {
    const nextStatus = staff.status === 'Active' ? 'Disabled' : 'Active';
    const nextSalesPos = staff.status === 'Active' ? false : true;
    try {
      const res = await adminService.toggleStaffStatus(staff._id, nextStatus, nextSalesPos);
      if (res && res.success) {
        showToast(res.message, 'success');
        loadPosStaff();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update staff access', 'error');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffConfirmModal) return;
    try {
      setDeletingStaff(true);
      const res = await adminService.deleteStaff(deleteStaffConfirmModal._id);
      if (res && res.success) {
        showToast(res.message || 'Staff access revoked. Historical sales records strictly preserved.', 'success');
        setDeleteStaffConfirmModal(null);
        loadPosStaff();
      }
    } catch (err) {
      showToast(err.message || 'Failed to revoke staff access', 'error');
    } finally {
      setDeletingStaff(false);
    }
  };

  const handleResetStaffAuth = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!resetStaffPassModal || !resetStaffPassValue) return;
    if (resetStaffPassValue.length < 6) {
      showToast('New password/PIN must be at least 6 characters', 'error');
      return;
    }
    try {
      setResetStaffPassSubmitting(true);
      const res = await adminService.resetStaffAuth(resetStaffPassModal._id, resetStaffPassValue);
      if (res && res.success) {
        showToast(res.message || 'Staff credentials updated successfully', 'success');
        setResetStaffPassModal(null);
        setResetStaffPassValue('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to reset staff password', 'error');
    } finally {
      setResetStaffPassSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // POS Reports & Comparison Handlers
  // ---------------------------------------------------------------------------
  const loadPosReports = () => {
    setLoadingPosReports(true);
    const params = {
      period: reportPeriodFilter,
      startDate: reportStartDate || undefined,
      endDate: reportEndDate || undefined,
      paymentMethod: reportPaymentFilter === 'all' ? undefined : reportPaymentFilter,
      area: reportAreaFilter === 'all' ? undefined : reportAreaFilter
    };
    if (selectedReportStaff && selectedReportStaff !== 'all') {
      params.staffId = selectedReportStaff;
    }
    adminService.getPosReports(params)
      .then(res => {
        if (res && res.success) {
          setPosReportsData(res.report || { summary: {}, transactions: [] });
        }
      })
      .catch(() => showToast('Failed to load POS sales reports', 'error'))
      .finally(() => setLoadingPosReports(false));
  };

  const loadComparison = () => {
    setLoadingComparison(true);
    adminService.getStaffComparison({
      period: comparisonPeriod,
      sortBy: comparisonSortBy
    })
      .then(res => {
        if (res && res.success) {
          setComparisonData(res.comparison || []);
        }
      })
      .catch(() => showToast('Failed to load staff performance comparison', 'error'))
      .finally(() => setLoadingComparison(false));
  };

  const handleExportReport = () => {
    const params = {
      period: reportPeriodFilter,
      startDate: reportStartDate || undefined,
      endDate: reportEndDate || undefined,
      paymentMethod: reportPaymentFilter === 'all' ? undefined : reportPaymentFilter,
      area: reportAreaFilter === 'all' ? undefined : reportAreaFilter
    };
    if (selectedReportStaff && selectedReportStaff !== 'all') {
      params.staffId = selectedReportStaff;
    }
    const exportUrl = adminService.exportPosReportUrl(params);
    window.open(exportUrl, '_blank');
  };

  const handleSavePermissions = async () => {
    if (!permissionModal) return;
    try {
      setSavingPermissions(true);
      const targetId = permissionModal.admin._id || permissionModal.admin.id;
      const res = await adminService.updateAdminUserPermissions(
        targetId,
        permissionModal.permissions
      );
      if (res.success) {
        showToast(`Permissions updated for ${permissionModal.admin.name}.`, 'success');
        setAdminUsers(prev => prev.map(a => {
          if ((a._id || a.id) === targetId) {
            return {
              ...a,
              permissions: res.user.permissions
            };
          }
          return a;
        }));
        if (user && ((user._id || user.id) === targetId)) {
          await refreshUser();
        }
        setPermissionModal(null);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  const isCurrentPanelPermitted = isPanelAuthorized(activePanel);

  if (authLoading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
      
      {/* ADMIN HEADER */}
      <div className="bg-forest-green text-white p-6 sm:p-8 rounded-3xl border-2 border-gold shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gold/20 border border-gold flex items-center justify-center flex-shrink-0">
            <Shield className="w-8 h-8 text-gold-light" />
          </div>
          <div>
            <h1 className="brand-font text-2xl sm:text-3xl font-bold text-gold-light">
              Admin Business Dashboard
            </h1>
            <p className="text-xs text-gray-300">
              AKE Rice – Ashok Kavin Rice Operations & Operations Command
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activePanel === 'analytics') loadAnalytics();
              if (activePanel === 'inventory') loadInventory();
              if (activePanel === 'products') loadAdminProducts();
              if (activePanel === 'sales-entry') loadRecentSales();
              if (activePanel === 'pos-staff') loadPosStaff();
              if (activePanel === 'pos-reports') {
                loadPosReports();
                loadComparison();
              }
              if (activePanel === 'orders') loadOrders();
              if (activePanel === 'reports') loadReports();
              if (activePanel === 'customers') loadCustomers();
              if (activePanel === 'feedback') loadFeedback();
              if (activePanel === 'admin-users') loadAdminUsers();
              if (activePanel === 'settings') showToast('Settings preferences loaded', 'info');
            }}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-gold/20 text-gold-light transition-colors"
            title="Refresh active panel"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold/20 text-gold-light border border-gold/30">
            Administrator: {user?.name}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RESPONSIVE DASHBOARD NAVIGATION GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {navPanels.map((p) => {
          const Icon = p.icon;
          const isActive = activePanel === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePanel(p.id)}
              className={`group relative flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer w-full h-full min-h-[66px] sm:min-h-[72px] ${
                isActive
                  ? 'bg-forest-green text-white border-2 border-gold shadow-lg ring-2 ring-gold/20 scale-[1.01]'
                  : 'bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200 border border-gray-200/90 dark:border-dark-border hover:border-gold/60 hover:bg-gold/5 dark:hover:bg-gold/10 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-gold/20 text-gold-light border border-gold/40'
                    : 'bg-forest-green/5 dark:bg-dark-bg text-gold-dark dark:text-gold group-hover:bg-gold/15 group-hover:text-gold'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs sm:text-sm font-bold leading-snug ${
                    isActive
                      ? 'text-gold-light'
                      : 'text-gray-800 dark:text-gray-100 group-hover:text-forest-green dark:group-hover:text-gold'
                  }`}
                >
                  {p.name}
                </div>
              </div>
              {isActive && (
                <div className="w-2 h-2 rounded-full bg-gold shrink-0 animate-pulse hidden sm:block" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* PANEL CONTENT OR UNAUTHORIZED ACCESS VIEW */}
      {/* ========================================================================= */}
      {!isCurrentPanelPermitted ? (
        <div className="bg-white dark:bg-dark-card p-8 sm:p-12 rounded-3xl border-2 border-red-300 dark:border-red-900 shadow-2xl text-center space-y-6 max-w-2xl mx-auto my-8 animate-in fade-in">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto border-2 border-red-200 dark:border-red-800 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800">
              <Lock className="w-3.5 h-3.5" />
              HTTP 403 • Unauthorized Module Access
            </span>
            <h3 className="brand-font text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Permission Required: {ALL_NAV_PANELS.find(p => p.id === activePanel)?.name || activePanel}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
              Your administrator account (<strong>{user?.name || 'Admin'}</strong>) does not have the required{' '}
              <code className="px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-bg text-forest-green dark:text-gold font-mono font-bold">
                {ALL_NAV_PANELS.find(p => p.id === activePanel)?.permission || activePanel}
              </code>{' '}
              permission to access this module.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-cream dark:bg-dark-bg border border-gold/30 text-xs text-left space-y-2">
            <div className="font-bold text-forest-green dark:text-gold flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              Access Control Policy
            </div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {activePanel === 'sales-entry'
                ? 'The Offline Sales Entry & POS Billing module is strictly restricted to administrator accounts that have been explicitly granted the sales_pos permission by the Super Admin.'
                : 'Access to this management module is restricted by role-based administrator permissions.'}
              {' '}Please contact the Super Admin (<strong>Kavin, +91 8489107668</strong>) to request access.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setActivePanel(navPanels[0]?.id || 'analytics')}
              className="px-6 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-105"
            >
              Return to Permitted Modules
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. ANALYTICS OVERVIEW PANEL */}
          {/* ========================================================================= */}
          {activePanel === 'analytics' && (
        <div className="space-y-8 animate-in fade-in">
          {loadingAnalytics || !analytics ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white dark:bg-dark-card rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Business Revenue</span>
                  <strong className="block text-3xl font-black text-forest-green dark:text-gold">
                    ₹{analytics.totalRevenue?.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[11px] text-emerald font-semibold">Online Orders + POS Sales</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Orders</span>
                  <strong className="block text-3xl font-black text-forest-green dark:text-gold">
                    {analytics.totalOrders}
                  </strong>
                  <span className="text-[11px] text-gray-400">Delivered: {analytics.deliveredOrders} &bull; Pending: {analytics.pendingOrders}</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Registered Customers</span>
                  <strong className="block text-3xl font-black text-forest-green dark:text-gold">
                    {analytics.customersCount}
                  </strong>
                  <span className="text-[11px] text-gray-400">Total active households & shops</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Customer Reviews</span>
                  <strong className="block text-3xl font-black text-forest-green dark:text-gold">
                    {analytics.feedbackCount}
                  </strong>
                  <span className="text-[11px] text-gray-400">5.0 Star rated quality score</span>
                </div>
              </div>

              {/* 7-Day Revenue Trend Line Chart (SVG) */}
              <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-xl space-y-4">
                <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                  7-Day Sales & Revenue Trend
                </h3>

                <div className="h-64 w-full flex items-end gap-3 pt-6 pb-2 px-4 border-b border-gray-200 dark:border-dark-border">
                  {analytics.last7Days.map((d, idx) => {
                    const maxRev = Math.max(...analytics.last7Days.map(x => x.revenue), 1000);
                    const heightPct = Math.max(10, Math.round((d.revenue / maxRev) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          ₹{d.revenue.toLocaleString('en-IN')}
                        </span>
                        <div
                          className="w-full max-w-[48px] rounded-t-xl bg-gradient-to-t from-forest-green to-gold transition-all duration-500 group-hover:from-gold group-hover:to-emerald"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid: Revenue by Area, Payment Share, Product Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Revenue by Area */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-4">
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">Revenue by Area</h4>
                  <div className="space-y-2.5">
                    {analytics.areaBreakdown.length === 0 ? (
                      <p className="text-xs text-gray-400">No area data yet.</p>
                    ) : (
                      analytics.areaBreakdown.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-dark-border">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{a.area}</span>
                          <strong className="text-forest-green dark:text-gold">₹{a.amount.toLocaleString('en-IN')}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Payment Share (COD vs Online) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-4">
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">Payment Method Share</h4>
                  <div className="space-y-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Online UPI ({analytics.paymentShare?.online?.count || 0})</span>
                        <strong className="text-blue-600">₹{analytics.paymentShare?.online?.amount?.toLocaleString('en-IN') || 0}</strong>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 dark:bg-dark-border overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${Math.round(((analytics.paymentShare?.online?.count || 0) / Math.max(1, analytics.paymentShare?.totalOrders || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Cash on Delivery ({analytics.paymentShare?.cash?.count || 0})</span>
                        <strong className="text-emerald">₹{analytics.paymentShare?.cash?.amount?.toLocaleString('en-IN') || 0}</strong>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 dark:bg-dark-border overflow-hidden">
                        <div
                          className="h-full bg-emerald"
                          style={{ width: `${Math.round(((analytics.paymentShare?.cash?.count || 0) / Math.max(1, analytics.paymentShare?.totalOrders || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1 KG vs 25 KG Product Comparison */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-4">
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">Product Distribution</h4>
                  <div className="space-y-3 pt-2 text-xs">
                    <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 flex justify-between items-center">
                      <div>
                        <strong className="block text-forest-green dark:text-gold-light">1 KG Zipper Pouch</strong>
                        <span className="text-gray-500">{analytics.productComparison?.p1kg?.units || 0} Pouches Sold</span>
                      </div>
                      <strong className="text-base font-bold text-forest-green dark:text-gold">
                        ₹{analytics.productComparison?.p1kg?.revenue?.toLocaleString('en-IN') || 0}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald/10 border border-emerald/20 flex justify-between items-center">
                      <div>
                        <strong className="block text-forest-green dark:text-gold-light">25 KG Wholesale Bag</strong>
                        <span className="text-gray-500">{analytics.productComparison?.p25kg?.units || 0} Bulk Bags Sold</span>
                      </div>
                      <strong className="text-base font-bold text-forest-green dark:text-gold">
                        ₹{analytics.productComparison?.p25kg?.revenue?.toLocaleString('en-IN') || 0}
                      </strong>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SALES ENTRY / POS PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'sales-entry' && (
        <div className="space-y-10 animate-in fade-in">
          
          <div className="bg-white dark:bg-dark-card p-6 sm:p-10 rounded-3xl border-2 border-gold/40 shadow-xl space-y-6">
            <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light pb-4 border-b border-gray-100 dark:border-dark-border">
              Offline Sales Entry & POS Billing
            </h3>

            {/* Variety Selector */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handlePosProductChange('1 KG Rice')}
                className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                  posProduct === '1 KG Rice'
                    ? 'bg-forest-green text-gold-light border-gold shadow'
                    : 'bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-gray-300'
                }`}
              >
                1 KG Rice Sale (₹195/KG)
              </button>
              <button
                type="button"
                onClick={() => handlePosProductChange('25 KG Rice')}
                className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                  posProduct === '25 KG Rice'
                    ? 'bg-forest-green text-gold-light border-gold shadow'
                    : 'bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-gray-300'
                }`}
              >
                25 KG Bulk Sale (₹185/KG = ₹4,625/Bag)
              </button>
            </div>

            <form onSubmit={handlePosSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Customer / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annapoorna Biryani House"
                    value={posShop}
                    onChange={(e) => setPosShop(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Area / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tiruchirappalli"
                    value={posArea}
                    onChange={(e) => setPosArea(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={posDate}
                    onChange={(e) => setPosDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Quantity ({posProduct === '25 KG Rice' ? 'Bags' : 'Pouches'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={posQty}
                    onChange={(e) => setPosQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm font-bold focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Rate per KG (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={posRate}
                    onChange={(e) => setPosRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm font-bold focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={posPayment}
                    onChange={(e) => setPosPayment(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online Payment">Online UPI / GPay</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Calculated Total</span>
                  <strong className="block text-2xl font-black text-forest-green dark:text-gold">
                    ₹{posTotal.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-8 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                >
                  Save POS Sales Entry
                </button>
              </div>
            </form>
          </div>

          {/* Recent Sales Log */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md space-y-4">
            <h4 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
              Recent Offline Sales Entries ({recentSales.length})
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Shop / Customer</th>
                    <th className="p-3">Area</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Salesperson</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {recentSales.map(s => (
                    <tr key={s.id} className="hover:bg-gold/5">
                      <td className="p-3 font-mono font-bold text-forest-green dark:text-gold">{s.id}</td>
                      <td className="p-3">{s.date}</td>
                      <td className="p-3 font-semibold">{s.shop}</td>
                      <td className="p-3">{s.area}</td>
                      <td className="p-3">{s.product}</td>
                      <td className="p-3">{s.qty}</td>
                      <td className="p-3 font-bold text-forest-green dark:text-gold">₹{s.total?.toLocaleString('en-IN')}</td>
                      <td className="p-3">{s.payment}</td>
                      <td className="p-3">{s.salesperson}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* STAFF MANAGEMENT PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'pos-staff' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Staff & Counter Control</span>
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                Staff Management
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Authorize retail and wholesale billing staff, control access permissions, and track individual sales performance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCreateStaffModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          </div>

          {/* Search, Filter & Stats Bar */}
          <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name, mobile, ID..."
                  value={posStaffSearch}
                  onChange={(e) => setPosStaffSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadPosStaff(); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs focus:outline-none focus:border-gold"
                />
              </div>

              {/* Status Filter Dropdown */}
              <select
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
              >
                <option value="all">All Statuses ({posStaffList.length})</option>
                <option value="Active">Active Only</option>
                <option value="Disabled">Disabled Only</option>
              </select>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => loadPosStaff()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPosStaff ? 'animate-spin' : ''}`} />
                <span>Refresh Staff</span>
              </button>
              <span className="text-xs font-semibold text-gray-500">
                Total Staff: <strong className="text-forest-green dark:text-gold">{posStaffList.length}</strong>
              </span>
            </div>
          </div>

          {/* Staff Roster Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
              <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                Authorized Staff Accounts
              </h4>
              <span className="text-xs text-gray-400">
                Staff members authenticate and bill offline sales at /pos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Staff ID</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Transactions</th>
                    <th className="p-4 text-right">Quantity Sold</th>
                    <th className="p-4 text-right">Total Sales</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {loadingPosStaff ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gold" />
                        Loading staff roster...
                      </td>
                    </tr>
                  ) : posStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-gray-400">
                        No staff members found matching filter. Click "Add Staff" to create an account.
                      </td>
                    </tr>
                  ) : (
                    posStaffList.map(staff => {
                      const isActive = staff.status === 'Active';
                      const hasPosPermission = staff.permissions?.sales_pos !== false;
                      const isPermitted = isActive && hasPosPermission;
                      const staffIdDisplay = staff.staffId || ('AKE-STF-' + (staff._id ? String(staff._id).slice(-3).toUpperCase() : '001'));
                      const createdDateFormatted = staff.createdAt
                        ? new Date(staff.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—';

                      return (
                        <tr key={staff._id || staff.id} className="hover:bg-gold/5 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-forest-green text-gold flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                {staff.name?.charAt(0)?.toUpperCase() || 'S'}
                              </div>
                              <div>
                                <strong className="font-bold text-sm text-gray-900 dark:text-white block">
                                  {staff.name}
                                </strong>
                                <span className="text-[11px] font-mono text-gray-400">
                                  @{staff.username || 'staff_' + (staff.mobile || '').slice(-4)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg bg-forest-green/10 text-forest-green dark:text-gold font-mono font-bold text-xs inline-block">
                              {staffIdDisplay}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600 dark:text-gray-300">
                            {staff.email || <span className="text-gray-400 italic">No email</span>}
                          </td>
                          <td className="p-4 font-mono font-semibold text-gray-800 dark:text-gray-200">
                            +91 {staff.mobile || '—'}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(staff)}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                                isPermitted
                                  ? 'bg-emerald/10 text-emerald hover:bg-emerald/20 border border-emerald/30'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                              }`}
                              title="Click to toggle active status and POS access"
                            >
                              {isPermitted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  <span>Disabled</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                            {staff.transactionCount || 0}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                            {(staff.totalQuantityKg || 0).toLocaleString('en-IN')} KG
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-forest-green dark:text-gold text-sm">
                            ₹{(staff.totalSales || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 font-mono text-gray-500 whitespace-nowrap text-[11px]">
                            {createdDateFormatted}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedStaffDetail(staff)}
                                className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition-colors cursor-pointer"
                                title="View staff details & permissions"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReportStaff(staff._id);
                                  setActiveReportTab('reports');
                                  setActivePanel('pos-reports');
                                }}
                                className="p-1.5 rounded-lg bg-forest-green/10 text-forest-green dark:text-gold hover:bg-forest-green hover:text-white transition-colors cursor-pointer"
                                title="View individual sales report"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditStaffModal({
                                  ...staff,
                                  staffId: staff.staffId || '',
                                  sales_pos: staff.permissions?.sales_pos !== false,
                                  view_own_sales: staff.permissions?.view_own_sales !== false,
                                  view_customer_info: staff.permissions?.view_customer_info === true
                                })}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-300 hover:bg-gold/20 hover:text-forest-green transition-colors cursor-pointer"
                                title="Edit staff profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetStaffPassModal(staff);
                                  setResetStaffPassValue('');
                                }}
                                className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                                title="Reset login credentials"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteStaffConfirmModal(staff)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Revoke & deactivate account (preserves sales)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* POS REPORTS & STAFF PERFORMANCE PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'pos-reports' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-wider">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>POS Analytics & Auditing</span>
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                POS Sales Reports & Performance
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track individual staff billing, audit transactions, analyze cash/UPI breakdown, and compare staff output.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportReport}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                title="Download CSV report of filtered transactions"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Report</span>
              </button>
            </div>
          </div>

          {/* Subtabs Switcher */}
          <div className="flex border-b border-gray-200 dark:border-dark-border gap-2">
            <button
              type="button"
              onClick={() => setActiveReportTab('reports')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeReportTab === 'reports'
                  ? 'border-forest-green dark:border-gold text-forest-green dark:text-gold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Staff Sales Report & Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveReportTab('comparison');
                loadComparison();
              }}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeReportTab === 'comparison'
                  ? 'border-forest-green dark:border-gold text-forest-green dark:text-gold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Staff Performance Comparison</span>
            </button>
          </div>

          {/* TAB 1: INDIVIDUAL & OVERALL STAFF SALES REPORT */}
          {activeReportTab === 'reports' && (
            <div className="space-y-6">
              
              {/* Filter Controls Bar */}
              <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-dark-border">
                  <h4 className="font-bold text-sm text-forest-green dark:text-gold-light flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gold" />
                    <span>Report Filters</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportStaff('all');
                      setReportPeriodFilter('today');
                      setReportStartDate('');
                      setReportEndDate('');
                      setReportPaymentFilter('all');
                      setReportAreaFilter('all');
                    }}
                    className="text-xs font-bold text-forest-green dark:text-gold hover:underline cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Staff Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                      Filter by Staff Member
                    </label>
                    <select
                      value={selectedReportStaff}
                      onChange={(e) => setSelectedReportStaff(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                    >
                      <option value="all">All POS Staff & Admins</option>
                      {posStaffList.map(st => (
                        <option key={st._id} value={st._id}>
                          {st.name} ({st.mobile ? `+91 ${st.mobile}` : `@${st.username}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Period Filter */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                      Time Period
                    </label>
                    <select
                      value={reportPeriodFilter}
                      onChange={(e) => setReportPeriodFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Date Range</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                      Payment Channel
                    </label>
                    <select
                      value={reportPaymentFilter}
                      onChange={(e) => setReportPaymentFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                    >
                      <option value="all">All Channels (Cash & UPI)</option>
                      <option value="Cash">Cash Settlements Only</option>
                      <option value="UPI">UPI / QR Settlements Only</option>
                    </select>
                  </div>

                  {/* Area / Market Filter */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                      Area / Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Koppampatty, Trichy..."
                      value={reportAreaFilter === 'all' ? '' : reportAreaFilter}
                      onChange={(e) => setReportAreaFilter(e.target.value || 'all')}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {/* Custom Date Pickers */}
                {reportPeriodFilter === 'custom' && (
                  <div className="pt-3 border-t border-gray-100 dark:border-dark-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 6 Key Performance Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Sales</span>
                  <div className="font-mono text-lg font-bold text-forest-green dark:text-gold">
                    ₹{(posReportsData.summary?.totalSales || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-gray-400 block">Gross revenue</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Volume Sold</span>
                  <div className="font-mono text-lg font-bold text-gray-800 dark:text-gray-200">
                    {(posReportsData.summary?.totalQuantityKg || 0).toLocaleString('en-IN')} <span className="text-xs">KG</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">Total rice weight</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Transactions</span>
                  <div className="font-mono text-lg font-bold text-gray-800 dark:text-gray-200">
                    {posReportsData.summary?.transactionCount || 0}
                  </div>
                  <span className="text-[10px] text-gray-400 block">Bills issued</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Avg Transaction</span>
                  <div className="font-mono text-lg font-bold text-gray-800 dark:text-gray-200">
                    ₹{(posReportsData.summary?.avgTransactionValue || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-gray-400 block">Per order average</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald">Cash Sales</span>
                  <div className="font-mono text-lg font-bold text-emerald">
                    ₹{(posReportsData.summary?.cashSales || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-gray-400 block">Cash collected</span>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gold/30 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">UPI Sales</span>
                  <div className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400">
                    ₹{(posReportsData.summary?.upiSales || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-gray-400 block">Direct QR payments</span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                    Transaction Audit Ledger
                  </h4>
                  <span className="text-xs text-gray-400">
                    {posReportsData.transactions?.length || 0} transactions match current filters
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                      <tr>
                        <th className="p-3.5">Date & Time</th>
                        <th className="p-3.5">Bill / TXN ID</th>
                        <th className="p-3.5">Billed By (Staff)</th>
                        <th className="p-3.5">Customer & Area</th>
                        <th className="p-3.5">Product & Qty</th>
                        <th className="p-3.5 text-right">Rate</th>
                        <th className="p-3.5 text-right">Total Amount</th>
                        <th className="p-3.5 text-center">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                      {loadingPosReports ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-gray-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold" />
                            Loading POS transaction ledger...
                          </td>
                        </tr>
                      ) : (posReportsData.transactions?.length || 0) === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-gray-400">
                            No POS transactions recorded for this filter selection.
                          </td>
                        </tr>
                      ) : (
                        posReportsData.transactions.map((tx, idx) => (
                          <tr key={tx._id || idx} className="hover:bg-gold/5 transition-colors">
                            <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                              {new Date(tx.createdAt || tx.date).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-200">
                              {tx.transactionId || (tx._id ? tx._id.slice(-8).toUpperCase() : 'POS-TXN')}
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-forest-green dark:text-gold block">
                                {tx.staffName || tx.salesperson || 'Staff'}
                              </span>
                              {tx.staffUserId && (
                                <span className="text-[10px] font-mono text-gray-400">
                                  ID: {tx.staffUserId.slice(-6)}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <div className="font-semibold text-gray-800 dark:text-gray-200">
                                {tx.customerName || tx.shop || 'Counter Retail'}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {tx.area || 'Direct Mill Counter'}
                              </div>
                            </td>
                            <td className="p-3.5 font-semibold text-gray-800 dark:text-gray-200">
                              {tx.product || tx.riceType || '1 KG Rice'} × {tx.quantity || tx.qty}
                            </td>
                            <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-300">
                              ₹{tx.rate || tx.ratePerKg || 195}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-forest-green dark:text-gold text-sm">
                              ₹{(tx.totalAmount || tx.total || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                (tx.paymentMethod || 'Cash') === 'Cash'
                                  ? 'bg-emerald/10 text-emerald'
                                  : 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300'
                              }`}>
                                {tx.paymentMethod || 'Cash'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: STAFF PERFORMANCE COMPARISON */}
          {activeReportTab === 'comparison' && (
            <div className="space-y-6">
              
              {/* Controls */}
              <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Period:
                  </span>
                  {['today', 'week', 'month', 'all'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setComparisonPeriod(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                        comparisonPeriod === p
                          ? 'bg-forest-green text-gold-light shadow'
                          : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Sort By:
                  </span>
                  <select
                    value={comparisonSortBy}
                    onChange={(e) => setComparisonSortBy(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs font-semibold focus:outline-none focus:border-gold"
                  >
                    <option value="sales">Highest Total Sales (₹)</option>
                    <option value="quantity">Highest Quantity Sold (KG)</option>
                    <option value="transactions">Highest Transactions</option>
                  </select>
                </div>
              </div>

              {/* Top Performer Highlight */}
              {comparisonData.length > 0 && (
                <div className="bg-gradient-to-r from-forest-green to-deep-green text-white p-6 sm:p-7 rounded-3xl border-2 border-gold shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gold/20 border border-gold flex items-center justify-center shrink-0">
                      <Award className="w-8 h-8 text-gold-light" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-gold-light">
                        🏆 Top Performing POS Staff
                      </div>
                      <h4 className="text-xl font-bold">
                        {comparisonData[0].staffName}
                      </h4>
                      <p className="text-xs text-gray-200">
                        Total Volume: {comparisonData[0].totalQuantityKg?.toLocaleString('en-IN')} KG • {comparisonData[0].transactions} Bills Completed
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:border-gold/30 sm:pl-6">
                    <span className="text-[10px] uppercase font-bold text-gold-light block">Gross Sales</span>
                    <span className="text-2xl font-bold font-mono text-gold-light">
                      ₹{(comparisonData[0].totalSales || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border">
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                    Team Sales & Conversion Rankings
                  </h4>
                  <p className="text-xs text-gray-400">
                    Cross-staff performance ranking for period: <span className="font-semibold capitalize text-forest-green dark:text-gold">{comparisonPeriod}</span>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                      <tr>
                        <th className="p-4 text-center">Rank</th>
                        <th className="p-4">Staff Member</th>
                        <th className="p-4 text-right">Transactions</th>
                        <th className="p-4 text-right">Quantity Sold</th>
                        <th className="p-4 text-right">Total Sales</th>
                        <th className="p-4 text-right">Avg Order</th>
                        <th className="p-4 text-center">Payment Split (Cash / UPI)</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                      {loadingComparison ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-gray-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold" />
                            Analyzing staff sales performance...
                          </td>
                        </tr>
                      ) : comparisonData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-gray-400">
                            No POS sales recorded across staff in this timeframe.
                          </td>
                        </tr>
                      ) : (
                        comparisonData.map((staff, idx) => (
                          <tr key={staff.staffId || idx} className="hover:bg-gold/5 transition-colors">
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-bold font-mono text-xs ${
                                idx === 0
                                  ? 'bg-gold text-forest-green shadow font-black'
                                  : idx === 1
                                  ? 'bg-gray-200 text-gray-700 font-bold'
                                  : idx === 2
                                  ? 'bg-amber-100 text-amber-800 font-bold'
                                  : 'bg-gray-50 dark:bg-dark-bg text-gray-400'
                              }`}>
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <strong className="text-sm font-bold text-gray-900 dark:text-white block">
                                {staff.staffName}
                              </strong>
                              {staff.mobile && (
                                <span className="text-[11px] font-mono text-gray-400">
                                  +91 {staff.mobile}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                              {staff.transactions || 0}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                              {(staff.totalQuantityKg || 0).toLocaleString('en-IN')} KG
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-forest-green dark:text-gold text-sm">
                              ₹{(staff.totalSales || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-4 text-right font-mono text-gray-700 dark:text-gray-300">
                              ₹{(staff.avgOrderValue || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-4 text-center">
                              <span className="font-mono text-[11px]">
                                <span className="text-emerald font-bold">₹{(staff.cashSales || 0).toLocaleString('en-IN')}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="text-sky-600 dark:text-sky-400 font-bold">₹{(staff.upiSales || 0).toLocaleString('en-IN')}</span>
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReportStaff(staff.staffId);
                                  setActiveReportTab('reports');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold hover:bg-forest-green hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BUSINESS REPORTS PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'reports' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Filter Bar */}
          <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-dark-border">
              <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                Filtered Business Reports
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportReportsCSV}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-green text-gold-light font-bold text-xs uppercase tracking-wider hover:bg-deep-green"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold/40 text-forest-green dark:text-gold font-bold text-xs uppercase tracking-wider hover:bg-gold/15"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Period</label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="thismonth">This Month</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Payment</label>
                <select
                  value={reportPayment}
                  onChange={(e) => setReportPayment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg"
                >
                  <option value="all">All Payments</option>
                  <option value="Cash">Cash / COD</option>
                  <option value="Online">Online Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Product</label>
                <select
                  value={reportProduct}
                  onChange={(e) => setReportProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg"
                >
                  <option value="all">All Products</option>
                  <option value="1 KG">1 KG Rice</option>
                  <option value="25 KG">25 KG Rice</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
                <select
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg"
                >
                  <option value="all">All Statuses</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={loadReports}
                  className="w-full py-2 rounded-xl bg-gold/25 hover:bg-gold/40 text-forest-green dark:text-gold-light font-bold text-xs uppercase tracking-wider"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-xs border-t border-gray-100 dark:border-dark-border font-bold">
              <span>Total Transactions: {reportRows.length}</span>
              <span className="text-forest-green dark:text-gold text-sm font-extrabold">
                Total Revenue: ₹{reportRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Report Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green text-white font-bold">
                  <tr>
                    <th className="p-3">Ref ID</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer / Shop</th>
                    <th className="p-3">Area</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {reportRows.map(r => (
                    <tr key={r.id} className="hover:bg-gold/5">
                      <td className="p-3 font-mono font-bold text-forest-green dark:text-gold">{r.id}</td>
                      <td className="p-3">{r.source}</td>
                      <td className="p-3">{r.date}</td>
                      <td className="p-3 font-semibold">{r.customer}</td>
                      <td className="p-3">{r.area}</td>
                      <td className="p-3">{r.product} (×{r.qty})</td>
                      <td className="p-3 font-bold text-forest-green dark:text-gold">₹{r.total?.toLocaleString('en-IN')}</td>
                      <td className="p-3">{r.payment}</td>
                      <td className="p-3 font-semibold">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STORE & WHATSAPP ORDERS PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'orders' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full sm:w-auto relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Order ID (AKE...), Customer Name, or Mobile..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-xs focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setTimeout(loadOrders, 100);
                }}
                className="px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Processing">Processing</option>
                <option value="Ready for Delivery">Ready for Delivery</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <button
                type="button"
                onClick={loadOrders}
                className="px-4 py-2 rounded-xl bg-forest-green text-gold-light text-xs font-bold uppercase tracking-wider"
              >
                Search
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green text-white font-bold">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3">Delivery Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gold/5">
                      <td className="p-3 font-mono font-bold text-forest-green dark:text-gold">{o.id}</td>
                      <td className="p-3">
                        <strong className="block text-gray-800 dark:text-gray-200">{o.name}</strong>
                        <span className="text-gray-400 font-mono">+91 {o.mobile}</span>
                      </td>
                      <td className="p-3">{o.product} (×{o.qty})</td>
                      <td className="p-3 font-bold text-forest-green dark:text-gold">₹{o.total?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="block font-semibold">{o.payment}</span>
                        {o.utr && <span className="text-[10px] text-gray-400">UTR: {o.utr}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            o.paymentStatus === 'Verified'
                              ? 'bg-emerald/20 text-emerald'
                              : o.paymentStatus === 'Rejected'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {o.paymentStatus}
                          </span>

                          {o.screenshot && (
                            <button
                              onClick={() => setLightboxImg(o.screenshot)}
                              className="p-1 text-gold hover:text-forest-green"
                              title="View screenshot proof"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          value={o.status}
                          onChange={(e) => handleStatusChange(o.id, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg font-semibold"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Processing">Processing</option>
                          <option value="Ready for Delivery">Ready for Delivery</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {o.screenshot && o.paymentStatus !== 'Verified' && (
                            <button
                              onClick={() => setPaymentVerifyModal({ order: o, action: 'verify' })}
                              className="px-2 py-1 rounded bg-emerald/20 text-emerald font-bold text-[10px] hover:bg-emerald/30"
                            >
                              Verify
                            </button>
                          )}
                          <a
                            href={`https://wa.me/91${o.mobile}?text=Hello%20${encodeURIComponent(o.name)},%20regarding%20your%20AKE%20Rice%20order%20${o.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-emerald hover:text-emerald-700"
                            title="Chat with Customer on WhatsApp"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Verification Remarks Modal */}
          {paymentVerifyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white dark:bg-dark-card rounded-3xl max-w-md w-full p-6 space-y-4 border border-gold shadow-2xl">
                <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                  Verify Payment for Order {paymentVerifyModal.order.id}
                </h3>
                <p className="text-xs text-gray-500">
                  Customer: <strong>{paymentVerifyModal.order.name}</strong> &bull; Amount: <strong>₹{paymentVerifyModal.order.total}</strong>
                </p>

                {paymentVerifyModal.order.screenshot && (
                  <div className="h-44 rounded-xl overflow-hidden border border-gold/30 bg-black/10">
                    <img
                      src={paymentVerifyModal.order.screenshot}
                      alt="Proof"
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => setLightboxImg(paymentVerifyModal.order.screenshot)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Verification Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Transaction verified in bank account"
                    value={verifyRemarks}
                    onChange={(e) => setVerifyRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg focus:outline-none focus:border-gold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      paymentVerifyModal.action = 'verify';
                      handlePaymentAction();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-bold text-xs uppercase"
                  >
                    Confirm Verify
                  </button>
                  <button
                    onClick={() => {
                      paymentVerifyModal.action = 'reject';
                      handlePaymentAction();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs uppercase"
                  >
                    Reject Payment
                  </button>
                  <button
                    onClick={() => setPaymentVerifyModal(null)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CUSTOMER REGISTRY PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'customers' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex items-center justify-between">
            <div>
              <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                Customer & Retail Registry ({customers.length})
              </h3>
              <p className="text-xs text-gray-500">Aggregated directory of home buyers and wholesale merchant shops.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green text-white font-bold">
                  <tr>
                    <th className="p-3">Customer / Shop</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Area</th>
                    <th className="p-3">Total Orders</th>
                    <th className="p-3">Total KG</th>
                    <th className="p-3">Total Spend</th>
                    <th className="p-3">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {customers.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gold/5">
                      <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{c.name}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.type.includes('Merchant') ? 'bg-purple-100 text-purple-700' : 'bg-emerald/15 text-emerald'
                        }`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{c.mobile}</td>
                      <td className="p-3">{c.area}</td>
                      <td className="p-3 font-bold">{c.totalOrders}</td>
                      <td className="p-3 font-semibold">{c.totalQtyKg} KG</td>
                      <td className="p-3 font-bold text-forest-green dark:text-gold">₹{c.totalSpent?.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-gray-400">{c.lastOrderDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT MANAGEMENT PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'products' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header & Quick Action */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                Dynamic Product Management
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure prices, package sizes, stock, images, and live storefront availability.
              </p>
            </div>

            <button
              onClick={() => handleOpenProductModal(null)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 text-gold" />
              <span>Add New Product</span>
            </button>
          </div>

          {/* Product Overview KPI Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/20 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Products</span>
                <strong className="block text-2xl font-black text-forest-green dark:text-gold-light">{products.length}</strong>
              </div>
              <div className="p-3 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                <Package className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-emerald/20 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald font-bold uppercase tracking-wider">Active on Storefront</span>
                <strong className="block text-2xl font-black text-emerald">
                  {products.filter(p => p.status === 'Active' || p.isAvailable).length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-emerald/10 text-emerald">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Inactive / Hidden</span>
                <strong className="block text-2xl font-black text-gray-400">
                  {products.filter(p => p.status === 'Inactive' || (!p.isAvailable && p.status !== 'Active')).length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-dark-bg text-gray-500">
                <XCircle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Products List / Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
              <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                Catalog Items ({products.length})
              </h4>
              <button
                onClick={loadAdminProducts}
                className="text-xs font-bold text-forest-green dark:text-gold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-3.5">Image</th>
                    <th className="p-3.5">Product Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Package Size</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Rate / KG</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {products.map(p => {
                    const isActive = p.status === 'Active' || (p.isAvailable && p.status !== 'Inactive');
                    return (
                      <tr key={p.id} className="hover:bg-gold/5 transition-colors">
                        <td className="p-3.5">
                          <img
                            src={formatProductImage(p.image)}
                            alt={p.name}
                            className="w-12 h-12 object-cover rounded-xl border border-gold/40 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setLightboxImg(formatProductImage(p.image))}
                          />
                        </td>
                        <td className="p-3.5">
                          <strong className="block text-sm text-gray-900 dark:text-gray-100 font-bold">{p.name}</strong>
                          <span className="text-[11px] text-gray-400">{p.tamilName}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-forest-green dark:text-gold-light border border-gold/25">
                            {p.category || 'Seeraga Samba'}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold">{p.packageSize} ({p.unitWeightKg} KG)</td>
                        <td className="p-3.5">
                          <strong className="text-sm font-black text-forest-green dark:text-gold">₹{p.price?.toLocaleString('en-IN')}</strong>
                        </td>
                        <td className="p-3.5 font-semibold text-gray-600 dark:text-gray-300">₹{p.ratePerKg} / KG</td>
                        <td className="p-3.5 font-bold">{p.stock} units</td>
                        <td className="p-3.5">
                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-emerald/15 text-emerald border border-emerald/30 hover:bg-emerald/25'
                                : 'bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-gray-400 border border-gray-300 hover:bg-gray-200'
                            }`}
                            title="Click to toggle product status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald' : 'bg-gray-400'}`} />
                            <span>{isActive ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenProductModal(p)}
                              className="p-1.5 rounded-lg bg-gold/15 text-forest-green dark:text-gold hover:bg-gold/30 transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT CREATE / EDIT MODAL */}
      {/* ========================================================================= */}
      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border-2 border-gold shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-4">
              <div>
                <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                  {productModal.mode === 'create' ? 'Add New Product' : `Edit Product: ${productModal.product?.name}`}
                </h3>
                <p className="text-xs text-gray-500">
                  Updates will immediately reflect on the public customer portal and order form.
                </p>
              </div>
              <button
                onClick={() => setProductModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5 KG Rice"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Tamil Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 கிலோ சீரக சம்பா அரிசி"
                    value={productForm.tamilName}
                    onChange={(e) => setProductForm({ ...productForm, tamilName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Seeraga Samba"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Package Size *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5 KG Bag"
                    value={productForm.packageSize}
                    onChange={(e) => setProductForm({ ...productForm, packageSize: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Unit Weight (KG) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={productForm.unitWeightKg}
                    onChange={(e) => {
                      const w = parseFloat(e.target.value) || 1;
                      setProductForm({
                        ...productForm,
                        unitWeightKg: w,
                        ratePerKg: productForm.price ? parseFloat((productForm.price / w).toFixed(2)) : productForm.ratePerKg
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Total Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={productForm.price}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      const w = productForm.unitWeightKg || 1;
                      setProductForm({
                        ...productForm,
                        price: p,
                        ratePerKg: parseFloat((p / w).toFixed(2))
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-bold text-forest-green dark:text-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Rate per KG (₹)
                  </label>
                  <input
                    type="number"
                    value={productForm.ratePerKg}
                    onChange={(e) => setProductForm({ ...productForm, ratePerKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Storefront Status
                  </label>
                  <select
                    value={productForm.status}
                    onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm font-semibold focus:outline-none focus:border-gold"
                  >
                    <option value="Active">Active (Visible & Orderable on Website)</option>
                    <option value="Inactive">Inactive (Hidden from Customers)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={productForm.displayOrder}
                    onChange={(e) => setProductForm({ ...productForm, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Product Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the grain, packaging, aroma, and recommended servings..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Product Image Selection & Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Product Image
                </label>
                <div className="flex items-center gap-4">
                  <img
                    src={formatProductImage(productForm.image)}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-xl border-2 border-gold/40 shadow"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="assets/packet_1kg.jpg or image URL"
                      value={productForm.image}
                      onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-xs focus:outline-none focus:border-gold font-mono"
                    />
                    <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gold/15 text-forest-green dark:text-gold text-xs font-bold cursor-pointer hover:bg-gold/25 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      <span>{uploadingProductImg ? 'Uploading...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProductModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CUSTOMER FEEDBACK MODERATION PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'feedback' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex items-center justify-between">
            <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
              Customer Feedback Moderation ({adminFeedback.length})
            </h3>
            <select
              value={feedbackFilter}
              onChange={(e) => {
                setFeedbackFilter(e.target.value);
                setTimeout(loadFeedback, 100);
              }}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs bg-white dark:bg-dark-bg font-semibold"
            >
              <option value="all">All Reviews</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="space-y-4">
            {adminFeedback.map(fb => (
              <div
                key={fb.id || fb._id}
                className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/25 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-base font-bold text-forest-green dark:text-gold-light capitalize">{fb.name}</strong>
                    <span className="text-xs text-gray-400 ml-2 font-mono">+91 {fb.mobile}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    fb.status === 'Approved' ? 'bg-emerald/20 text-emerald' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {fb.status}
                  </span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300">
                  "{fb.review}"
                </p>

                {fb.photo && (
                  <img
                    src={fb.photo}
                    alt="Proof"
                    className="w-16 h-16 object-cover rounded-xl border border-gold cursor-pointer"
                    onClick={() => setLightboxImg(fb.photo)}
                  />
                )}

                {fb.adminResponse && (
                  <div className="p-3 rounded-xl bg-forest-green/5 text-xs text-forest-green dark:text-gold">
                    <strong>Admin Reply:</strong> {fb.adminResponse}
                  </div>
                )}

                {/* Moderation Controls */}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {fb.status !== 'Approved' && (
                      <button
                        onClick={() => handleModerateFeedback(fb.id, 'approve')}
                        className="px-3 py-1 rounded-lg bg-emerald text-white font-bold text-[11px]"
                      >
                        Approve
                      </button>
                    )}
                    {fb.status !== 'Rejected' && (
                      <button
                        onClick={() => handleModerateFeedback(fb.id, 'reject')}
                        className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px]"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => setReplyModal(fb)}
                      className="px-3 py-1 rounded-lg bg-gold/20 text-forest-green dark:text-gold font-bold text-[11px]"
                    >
                      Reply to Customer
                    </button>
                  </div>

                  <button
                    onClick={() => handleModerateFeedback(fb.id, 'delete')}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Admin Reply Modal */}
          {replyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white dark:bg-dark-card rounded-3xl max-w-md w-full p-6 space-y-4 border border-gold shadow-2xl">
                <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                  Reply to {replyModal.name}'s Feedback
                </h3>
                <textarea
                  rows={4}
                  placeholder="Type official store reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-bg focus:outline-none focus:border-gold"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleModerateFeedback(replyModal.id, 'update', replyText)}
                    className="px-5 py-2 rounded-xl bg-forest-green text-gold-light font-bold text-xs"
                  >
                    Submit Reply
                  </button>
                  <button
                    onClick={() => setReplyModal(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTOMATIC INVENTORY MANAGEMENT PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'inventory' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header & Actions */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-wider">
                <Boxes className="w-3.5 h-3.5" />
                <span>Automatic Inventory Control</span>
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                Stock & Inventory Management
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Formula: Available Stock = Initial Stock - Total Confirmed Order Quantity. Live KG tracking with automatic order deduction and cancellation restoration.
              </p>
            </div>

            <button
              onClick={loadInventory}
              disabled={loadingInventory}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs shadow-md transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInventory ? 'animate-spin' : ''}`} />
              <span>Refresh Inventory</span>
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">
                  Total Initial Stock
                </span>
                <strong className="text-2xl font-black text-forest-green dark:text-gold-light">
                  {inventorySummary ? inventorySummary.totalInitialKg.toLocaleString('en-IN') : '0'} <span className="text-sm font-semibold">KG</span>
                </strong>
                <span className="text-[11px] text-gray-400 block mt-0.5">Catalog base allocation</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-forest-green/10 text-forest-green dark:text-gold">
                <Boxes className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-emerald/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                  Available Stock
                </span>
                <strong className="text-2xl font-black text-emerald">
                  {inventorySummary ? inventorySummary.totalAvailableKg.toLocaleString('en-IN') : '0'} <span className="text-sm font-semibold">KG</span>
                </strong>
                <span className="text-[11px] text-emerald-600 block mt-0.5">Ready for booking</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald/10 text-emerald">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-forest-green dark:text-gold font-bold uppercase tracking-wider block">
                  Total Ordered / Sold
                </span>
                <strong className="text-2xl font-black text-forest-green dark:text-gold">
                  {inventorySummary ? inventorySummary.totalOrderedKg.toLocaleString('en-IN') : '0'} <span className="text-sm font-semibold">KG</span>
                </strong>
                <span className="text-[11px] text-gray-400 block mt-0.5">Confirmed customer orders</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-gold/15 text-gold-dark dark:text-gold">
                <ShoppingBag className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-amber/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block">
                  Stock Status Alerts
                </span>
                <strong className="text-2xl font-black text-amber-600">
                  {(inventorySummary?.lowStockCount || 0) + (inventorySummary?.outOfStockCount || 0)} <span className="text-sm font-semibold">Items</span>
                </strong>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  {inventorySummary?.lowStockCount || 0} Low, {inventorySummary?.outOfStockCount || 0} Out
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Product Stock Breakdown Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                  Product Inventory Breakdown
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dynamic calculations based on confirmed customer orders and admin stock inputs.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-3.5">Product & Package</th>
                    <th className="p-3.5 text-center">Unit Weight</th>
                    <th className="p-3.5 text-right">Initial Stock (KG)</th>
                    <th className="p-3.5 text-right">Total Ordered (KG)</th>
                    <th className="p-3.5 text-right">Available Stock (KG)</th>
                    <th className="p-3.5 text-right">Alert Threshold</th>
                    <th className="p-3.5 text-center">Stock Status</th>
                    <th className="p-3.5 text-center">Store Visibility</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {inventoryProducts.length > 0 ? (
                    inventoryProducts.map(p => {
                      const avail = p.availableStockKg !== undefined ? p.availableStockKg : 5000;
                      const initial = p.initialStockKg !== undefined ? p.initialStockKg : 5000;
                      const ordered = p.totalOrderedKg !== undefined ? p.totalOrderedKg : 0;
                      const isLow = p.stockStatus === 'LOW STOCK';
                      const isOut = p.stockStatus === 'OUT OF STOCK';

                      return (
                        <tr key={p.id} className="hover:bg-cream/40 dark:hover:bg-dark-border/40 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={formatProductImage(p.image)}
                                alt={p.name}
                                className="w-9 h-9 rounded-lg object-cover border border-gold/30"
                              />
                              <div>
                                <strong className="font-bold text-forest-green dark:text-gold-light block text-sm">{p.name}</strong>
                                <span className="text-[11px] text-gray-400">{p.packageSize} • ₹{p.price}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-medium text-gray-600 dark:text-gray-300">
                            {p.unitWeightKg || 1} KG
                          </td>
                          <td className="p-3.5 text-right font-bold text-gray-700 dark:text-gray-200">
                            {initial.toLocaleString('en-IN')} KG
                          </td>
                          <td className="p-3.5 text-right font-bold text-forest-green dark:text-gold">
                            {ordered.toLocaleString('en-IN')} KG
                          </td>
                          <td className="p-3.5 text-right">
                            <strong className={`text-sm font-black ${
                              isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald'
                            }`}>
                              {avail.toLocaleString('en-IN')} KG
                            </strong>
                          </td>
                          <td className="p-3.5 text-right text-gray-500 font-medium">
                            {p.lowStockThresholdKg || 200} KG
                          </td>
                          <td className="p-3.5 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                OUT OF STOCK
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald/10 text-emerald border border-emerald/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                                IN STOCK
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'Active' ? 'bg-emerald/10 text-emerald' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {p.status || 'Active'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleOpenAdjustModal(p)}
                              className="px-3 py-1.5 rounded-xl bg-forest-green/10 hover:bg-forest-green hover:text-white text-forest-green dark:text-gold dark:hover:bg-gold dark:hover:text-forest-green font-bold text-[11px] transition-colors"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-gray-400 font-medium">
                        {loadingInventory ? 'Loading inventory data...' : 'No products found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Inventory Audit Transaction Logs Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4 text-gold-dark dark:text-gold" />
                  <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                    Real-Time Inventory Transaction Audit Logs
                  </h4>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every order deduction, cancellation restoration, and administrative stock entry is permanently recorded.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300">
                {inventoryTransactions.length} Audit Entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-3.5">Txn ID</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-right">Quantity (KG)</th>
                    <th className="p-3.5 text-center">Stock Audit</th>
                    <th className="p-3.5">Details / Order Reference</th>
                    <th className="p-3.5">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {inventoryTransactions.length > 0 ? (
                    inventoryTransactions.map(txn => {
                      const isDeduction = txn.type === 'Order Deduction' || txn.type === 'POS Sale Deduction';
                      const isRestoration = txn.type === 'Stock Restoration';

                      return (
                        <tr key={txn.id || txn._id} className="hover:bg-cream/40 dark:hover:bg-dark-border/40 transition-colors">
                          <td className="p-3.5 font-mono text-[11px] text-gray-500">
                            {txn.id}
                          </td>
                          <td className="p-3.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            <span className="block font-semibold">{txn.date || new Date(txn.createdAt).toISOString().split('T')[0]}</span>
                            <span className="text-[10px] text-gray-400">{txn.time || ''}</span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isDeduction 
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : isRestoration
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-gold/20 text-forest-green dark:text-gold border border-gold/30'
                            }`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-forest-green dark:text-gold-light">
                            {txn.productName}
                          </td>
                          <td className="p-3.5 text-right font-black">
                            <span className={isDeduction ? 'text-red-600' : 'text-emerald'}>
                              {isDeduction ? `-${txn.qtyKg}` : `+${txn.qtyKg}`} KG
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono text-[11px]">
                            <span className="text-gray-400">{txn.stockBefore} KG</span>
                            <span className="mx-1 text-gray-300">→</span>
                            <strong className="text-gray-800 dark:text-gray-100">{txn.stockAfter} KG</strong>
                          </td>
                          <td className="p-3.5 text-gray-700 dark:text-gray-300 max-w-xs truncate" title={txn.note}>
                            {txn.note}
                          </td>
                          <td className="p-3.5 text-gray-500 font-medium">
                            {txn.performedBy || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-400 font-medium">
                        No inventory transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN ACCOUNT MANAGEMENT PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'admin-users' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>Security & Access Control</span>
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                Administrator Accounts
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage authorized administrator profiles, toggle active status, and reset access credentials. Public sign-up is strictly disabled.
              </p>
            </div>

            <button
              onClick={() => {
                setNewAdminForm({ name: '', username: '', email: '', mobile: '', password: '' });
                setMobileCheckResult(null);
                setShowPromoteConfirm(false);
                setCreateAdminModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-105"
            >
              <UserPlus className="w-4 h-4 text-gold" />
              <span>Add New Administrator</span>
            </button>
          </div>

          {/* Admin Accounts Table */}
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
              <h4 className="font-bold text-base text-forest-green dark:text-gold-light">
                Authorized Admins ({adminUsers.length})
              </h4>
              <button
                onClick={loadAdminUsers}
                className="text-xs font-bold text-forest-green dark:text-gold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                  <tr>
                    <th className="p-3.5">Administrator</th>
                    <th className="p-3.5">Mobile & OTP Status</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5 text-center">Role</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Last Login</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {adminUsers.length > 0 ? (
                    adminUsers.map(adm => {
                      const isPrimary = ['Kavin', 'Ashok Kumar'].includes(adm.name) || adm.mobile === '8489107668';
                      const isSelf = user?._id && (user._id.toString() === (adm._id || adm.id).toString());
                      const isDisabled = adm.status === 'Disabled';
                      const isVerified = adm.mobileVerified;

                      return (
                        <tr key={adm._id || adm.id} className="hover:bg-cream/40 dark:hover:bg-dark-border/40 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-forest-green text-gold-light font-bold flex items-center justify-center text-xs shadow-sm">
                                {adm.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong className="font-bold text-forest-green dark:text-gold-light block text-sm">{adm.name}</strong>
                                {isPrimary ? (
                                  <span className="text-[10px] text-gold-dark font-bold">Founder / Super Admin</span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-mono">@{adm.username || adm.name?.toLowerCase().replace(/\s+/g, '')}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="space-y-1">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {adm.mobile ? `+91 ${adm.mobile}` : '—'}
                              </span>
                              <div>
                                {isVerified ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald/10 text-emerald border border-emerald/30">
                                    <CheckCircle2 className="w-3 h-3" /> Mobile Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                                    <Clock className="w-3 h-3" /> Pending 1st OTP
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-gray-600 dark:text-gray-300">
                            {adm.email || '—'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-forest-green/10 text-forest-green dark:text-gold uppercase tracking-wider block">
                                {adm.isSuperAdmin || isPrimary ? 'Super Admin' : (adm.role || 'admin')}
                              </span>
                              {adm.isSuperAdmin || isPrimary ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold-dark dark:text-gold">
                                  <CheckCircle2 className="w-3 h-3 text-gold" /> All Permissions
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  adm.permissions?.sales_pos 
                                    ? 'bg-emerald/10 text-emerald border border-emerald/20' 
                                    : 'bg-gray-100 dark:bg-dark-bg text-gray-500 border border-gray-200'
                                }`}>
                                  {adm.permissions?.sales_pos ? 'POS: Allowed' : 'POS: Locked'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isDisabled
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald/10 text-emerald border border-emerald/30'
                            }`}>
                              {adm.status || 'Active'}
                            </span>
                          </td>
                          <td className="p-3.5 text-gray-500 text-[11px]">
                            {adm.lastLogin ? new Date(adm.lastLogin).toLocaleString('en-IN') : (adm.createdAt ? new Date(adm.createdAt).toLocaleDateString('en-IN') : 'Recent')}
                          </td>
                          <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditAdminModal(adm);
                                setEditAdminForm({
                                  name: adm.name || '',
                                  mobile: adm.mobile || '',
                                  email: adm.email || '',
                                  username: adm.username || '',
                                  status: adm.status || 'Active'
                                });
                              }}
                              className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gold/20 text-gray-700 dark:bg-dark-bg dark:text-gray-300 dark:hover:text-gold font-bold text-[11px] transition-colors"
                              title="Edit Admin"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </button>

                            {isSuperAdmin && (
                              <button
                                onClick={() => {
                                  const p = adm.permissions || {};
                                  setPermissionModal({
                                    admin: adm,
                                    permissions: {
                                      analytics: p.analytics ?? true,
                                      inventory: p.inventory ?? true,
                                      products: p.products ?? true,
                                      sales_pos: p.sales_pos ?? false,
                                      reports: p.reports ?? true,
                                      orders: p.orders ?? true,
                                      whatsapp_orders: p.whatsapp_orders ?? true,
                                      customers: p.customers ?? true,
                                      feedback: p.feedback ?? true,
                                      admin_management: p.admin_management ?? false,
                                      settings: p.settings ?? false
                                    }
                                  });
                                }}
                                className="px-2.5 py-1 rounded-xl bg-gold/15 hover:bg-gold text-forest-green hover:text-white dark:text-gold dark:hover:text-forest-green font-bold text-[11px] transition-colors"
                                title="Manage Permissions"
                              >
                                <Key className="w-3.5 h-3.5 inline mr-1" />
                                Permissions
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleAdminStatus(adm)}
                              disabled={isSelf || isPrimary}
                              className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-colors ${
                                isSelf || isPrimary
                                  ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
                                  : isDisabled
                                  ? 'bg-emerald/10 text-emerald hover:bg-emerald hover:text-white'
                                  : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                              }`}
                              title={isSelf ? 'Cannot disable yourself' : isPrimary ? 'Cannot disable founder' : undefined}
                            >
                              {isDisabled ? 'Enable' : 'Disable'}
                            </button>

                            <button
                              onClick={() => handleDeleteAdmin(adm)}
                              disabled={isSelf || isPrimary}
                              className={`px-2 py-1 rounded-xl font-bold text-[11px] transition-colors ${
                                isSelf || isPrimary
                                  ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
                                  : 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white'
                              }`}
                              title={isSelf ? 'Cannot delete yourself' : isPrimary ? 'Cannot delete founder' : 'Delete admin account'}
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-400 font-medium">
                        {loadingAdmins ? 'Loading admin accounts...' : 'No admin accounts found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. SYSTEM & STORE SETTINGS PANEL */}
      {/* ========================================================================= */}
      {activePanel === 'settings' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Header */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-wider">
                <Settings className="w-3.5 h-3.5" />
                <span>Operations & Preferences</span>
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                System & Store Settings
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Operational parameters, business helplines, security rules, and communication configuration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Store & Contact Settings */}
            <div className="bg-white dark:bg-dark-card p-6 sm:p-7 rounded-3xl border border-gold/30 shadow-md space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold flex items-center justify-center font-bold text-lg">
                  🌾
                </div>
                <div>
                  <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Store & Brand Information</h4>
                  <p className="text-xs text-gray-400">Official business identity and customer hotline</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Brand Name</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">AKE Rice (Ashok Kavin Enterprises)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Core Specialty</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">Koppampatty Seeraga Samba Rice</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">WhatsApp Order Hotline</span>
                  <span className="font-bold font-mono text-forest-green dark:text-gold">+91 84891 07668</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Founder Helpline</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">+91 84891 07668</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Operating Mill Location</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">Koppampatty, Tamil Nadu, India</span>
                </div>
              </div>
            </div>

            {/* Authentication & Security Settings */}
            <div className="bg-white dark:bg-dark-card p-6 sm:p-7 rounded-3xl border border-gold/30 shadow-md space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Security & Authentication</h4>
                  <p className="text-xs text-gray-400">Admin access rules & OTP verification</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Admin Login Method</span>
                  <span className="font-bold text-emerald dark:text-emerald font-mono">Gmail SMTP Email OTP</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">OTP Code Length</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">4 Digits (Cryptographically Secure)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">OTP Expiration</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">5 Minutes</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Resend Cooldown</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">30 Seconds</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Customer Access</span>
                  <span className="font-bold text-forest-green dark:text-gold">Open Storefront (No Login Required)</span>
                </div>
              </div>
            </div>

            {/* Payment & Order Processing */}
            <div className="bg-white dark:bg-dark-card p-6 sm:p-7 rounded-3xl border border-gold/30 shadow-md space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Payment & Settlement</h4>
                  <p className="text-xs text-gray-400">Supported checkout payment channels</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Direct UPI / QR</span>
                  <span className="font-bold text-emerald dark:text-emerald">Active (GPay, PhonePe, Paytm, BHIM)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
                  <span className="text-gray-500">Cash on Delivery (COD)</span>
                  <span className="font-bold text-emerald dark:text-emerald">Active</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Currency</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">INR (₹)</span>
                </div>
              </div>
            </div>

            {/* Quick Module Shortcuts */}
            <div className="bg-white dark:bg-dark-card p-6 sm:p-7 rounded-3xl border border-gold/30 shadow-md space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Quick Module Actions</h4>
                  <p className="text-xs text-gray-400">Direct shortcuts to key dashboard panels</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('inventory')}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg hover:bg-gold/10 border border-gray-200 dark:border-dark-border text-left font-bold text-xs text-forest-green dark:text-gold transition-colors cursor-pointer"
                >
                  📦 Inventory Stock
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('products')}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg hover:bg-gold/10 border border-gray-200 dark:border-dark-border text-left font-bold text-xs text-forest-green dark:text-gold transition-colors cursor-pointer"
                >
                  🌾 Product Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('admin-users')}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg hover:bg-gold/10 border border-gray-200 dark:border-dark-border text-left font-bold text-xs text-forest-green dark:text-gold transition-colors cursor-pointer"
                >
                  🛡️ Admin Users
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('orders')}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg hover:bg-gold/10 border border-gray-200 dark:border-dark-border text-left font-bold text-xs text-forest-green dark:text-gold transition-colors cursor-pointer"
                >
                  🛍️ Store Orders
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
      </>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Adjust Stock Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Adjust Inventory: {adjustModal.name}
                  </h3>
                  <p className="text-xs text-gray-500">{adjustModal.packageSize} • Current Available: {adjustModal.availableStockKg} KG</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModal(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustStock} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Initial Stock (KG)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustForm.initialStockKg}
                    onChange={(e) => setAdjustForm({ ...adjustForm, initialStockKg: e.target.value, addStockKg: '', setAvailableStockKg: '' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-bold"
                    placeholder="e.g. 5000"
                  />
                  <span className="text-[10px] text-gray-400">Available = Initial - Total Ordered</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Or Add Stock / Replenish (KG)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustForm.addStockKg}
                    onChange={(e) => setAdjustForm({ ...adjustForm, addStockKg: e.target.value, initialStockKg: '', setAvailableStockKg: '' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-bold"
                    placeholder="+ KG (e.g. 500)"
                  />
                  <span className="text-[10px] text-gray-400">Adds directly to current stock</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Low Stock Alert Threshold (KG)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustForm.lowStockThresholdKg}
                  onChange={(e) => setAdjustForm({ ...adjustForm, lowStockThresholdKg: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  placeholder="e.g. 200"
                />
                <span className="text-[10px] text-gray-400">Triggers LOW STOCK badge when available falls below this</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Adjustment Reason / Note *
                </label>
                <input
                  type="text"
                  required
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  placeholder="e.g. Harvest mill restock, physical count audit, correction"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Saving...' : 'Confirm Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Admin User Modal */}
      {createAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Add New Administrator
                  </h3>
                  <p className="text-xs text-gray-500">Authorize a team member with SMS OTP login access.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCreateAdminModal(false);
                  setMobileCheckResult(null);
                  setShowPromoteConfirm(false);
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Selvam Kumar"
                  value={newAdminForm.name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number * (For SMS OTP)
                </label>
                <div className="flex rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden focus-within:border-gold">
                  <div className="px-3 py-2.5 bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border text-xs font-bold text-gray-600 dark:text-gray-300">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={14}
                    placeholder="e.g. 8838048371"
                    value={newAdminForm.mobile}
                    onChange={handleMobileInputChange}
                    className="w-full px-3 py-2.5 bg-transparent text-sm font-semibold tracking-wider focus:outline-none"
                  />
                  {checkingMobile && (
                    <div className="flex items-center px-3 text-gold">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  A 6-digit verification code will be sent to this number when logging in.
                </span>

                {/* Mobile check status feedback */}
                {mobileCheckResult && (
                  <div className="mt-2.5">
                    {mobileCheckResult.isSuperAdmin && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <strong>Super Admin Account Protected:</strong>
                          <p className="mt-0.5">This mobile number belongs to the founder Super Admin account (+91 {mobileCheckResult.user?.mobile || newAdminForm.mobile}) and cannot be modified or duplicated.</p>
                        </div>
                      </div>
                    )}

                    {!mobileCheckResult.isSuperAdmin && mobileCheckResult.exists && mobileCheckResult.role === 'admin' && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <strong>Already Registered as Admin:</strong>
                          <p className="mt-0.5">This mobile number is already registered as an Admin ({mobileCheckResult.user?.name}, status: {mobileCheckResult.user?.status || 'Active'}).</p>
                        </div>
                      </div>
                    )}

                    {!mobileCheckResult.isSuperAdmin && mobileCheckResult.exists && mobileCheckResult.canPromote && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div className="flex-1">
                            <span className="font-bold text-amber-800 dark:text-amber-300">
                              Customer Account Detected
                            </span>
                            <p className="mt-0.5 text-amber-700 dark:text-amber-200">
                              An account with this mobile number already exists as a Customer:
                            </p>
                            <div className="mt-2 p-2 bg-white/80 dark:bg-dark-card/80 rounded-lg border border-amber-200 dark:border-amber-800 space-y-0.5 text-[11px]">
                              <div><strong>Name:</strong> {mobileCheckResult.user?.name}</div>
                              <div><strong>Mobile:</strong> +91 {mobileCheckResult.user?.mobile}</div>
                              {mobileCheckResult.user?.email && <div><strong>Email:</strong> {mobileCheckResult.user.email}</div>}
                              <div><strong>Current Role:</strong> Customer</div>
                            </div>
                            <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">
                              Do you want to promote this account to Admin?
                            </p>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                              ✓ All existing order history, delivery addresses, and customer data will be safely preserved.
                              <br />
                              ✓ They will be authorized to log in to the Admin Dashboard via SMS OTP.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!mobileCheckResult.exists && (
                      <div className="p-2.5 rounded-xl bg-emerald/10 border border-emerald/30 text-xs text-emerald dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Mobile number is available. A new Administrator account will be created.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. selvam_admin"
                    value={newAdminForm.username}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="admin@akerice.com"
                    value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-forest-green/5 border border-forest-green/20 text-[11px] text-forest-green dark:text-gold flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0 text-gold" />
                <span>Passwordless authentication. Administrator authenticates securely via single-use SMS OTP.</span>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateAdminModal(false);
                    setMobileCheckResult(null);
                    setShowPromoteConfirm(false);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>

                {mobileCheckResult?.canPromote ? (
                  <button
                    type="button"
                    onClick={handleConfirmPromotion}
                    disabled={createAdminSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {createAdminSubmitting ? 'Promoting...' : 'Promote Customer to Admin'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      createAdminSubmitting || 
                      !newAdminForm.name.trim() || 
                      normalizeIndianMobile(newAdminForm.mobile).length !== 10 ||
                      mobileCheckResult?.isSuperAdmin ||
                      (mobileCheckResult?.exists && mobileCheckResult?.role === 'admin')
                    }
                    className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
                  >
                    {createAdminSubmitting ? 'Creating...' : 'Create Admin Account'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin User Modal */}
      {editAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Edit Administrator
                  </h3>
                  <p className="text-xs text-gray-500">Update admin profile and registered mobile number.</p>
                </div>
              </div>
              <button
                onClick={() => setEditAdminModal(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editAdminForm.name}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number * (SMS OTP Recipient)
                </label>
                <div className="flex rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden focus-within:border-gold">
                  <div className="px-3 py-2.5 bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border text-xs font-bold text-gray-600 dark:text-gray-300">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editAdminForm.mobile}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2.5 bg-transparent text-sm font-semibold tracking-wider focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Changing mobile number resets verification status until next successful OTP login.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editAdminForm.username}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editAdminForm.status}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  >
                    <option value="Active">Active (Permitted)</option>
                    <option value="Disabled">Disabled (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editAdminForm.email}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditAdminModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editAdminSubmitting || !editAdminForm.name.trim() || editAdminForm.mobile.replace(/\D/g, '').length !== 10}
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {editAdminSubmitting ? 'Saving...' : 'Save Admin Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Management Modal */}
      {permissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gold/20 text-gold-dark dark:text-gold flex items-center justify-center border border-gold/30">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                    Manage Admin Permissions
                  </h3>
                  <p className="text-xs text-gray-500">
                    Administrator: <strong className="text-forest-green dark:text-gold">{permissionModal.admin.name}</strong> ({permissionModal.admin.mobile ? `+91 ${permissionModal.admin.mobile}` : (permissionModal.admin.email || '—')})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Super Admin Notice if applicable */}
            {(permissionModal.admin.isSuperAdmin || ['Kavin', 'Ashok Kumar'].includes(permissionModal.admin.name) || permissionModal.admin.mobile === '8489107668') ? (
              <div className="p-4 rounded-2xl bg-gold/10 border border-gold/40 text-xs text-gold-dark dark:text-gold-light flex items-center gap-3">
                <Shield className="w-5 h-5 flex-shrink-0 text-gold" />
                <div>
                  <strong>Super Admin Account:</strong> This founder account has permanent full access across all 10 system modules. Permissions cannot be restricted.
                </div>
              </div>
            ) : (
              <>
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-xs">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Quick Presets:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPermissionModal(prev => ({
                          ...prev,
                          permissions: {
                            analytics: true, inventory: true, products: true, sales_pos: true,
                            pos_staff_management: true, pos_reports: true, pos_reports_all_staff: true,
                            reports: true, orders: true, whatsapp_orders: true, customers: true,
                            feedback: true, admin_management: false, settings: true
                          }
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald hover:text-white font-bold transition-colors"
                    >
                      Grant All (Including POS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPermissionModal(prev => ({
                          ...prev,
                          permissions: {
                            analytics: true, inventory: true, products: true, sales_pos: false,
                            pos_staff_management: false, pos_reports: false, pos_reports_all_staff: false,
                            reports: true, orders: true, whatsapp_orders: true, customers: true,
                            feedback: true, admin_management: false, settings: false
                          }
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 transition-colors"
                    >
                      Default (POS Disabled)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPermissionModal(prev => ({
                          ...prev,
                          permissions: {
                            analytics: false, inventory: false, products: false, sales_pos: false,
                            pos_staff_management: false, pos_reports: false, pos_reports_all_staff: false,
                            reports: false, orders: false, whatsapp_orders: false, customers: false,
                            feedback: false, admin_management: false, settings: false
                          }
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-bold transition-colors"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                {/* Permissions List */}
                <div className="space-y-3">
                  {PERMISSION_LIST.map(p => {
                    const isChecked = !!permissionModal.permissions[p.key];
                    const isPos = p.key === 'sales_pos';
                    return (
                      <label
                        key={p.key}
                        className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                          isPos
                            ? isChecked
                              ? 'bg-gold/10 border-gold shadow-sm ring-1 ring-gold'
                              : 'bg-white dark:bg-dark-bg border-gold/40 hover:border-gold'
                            : isChecked
                            ? 'bg-forest-green/5 dark:bg-dark-bg border-forest-green/40'
                            : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPermissionModal(prev => {
                              const updated = { ...prev.permissions, [p.key]: val };
                              if (p.key === 'orders') updated.whatsapp_orders = val;
                              if (p.key === 'whatsapp_orders') updated.orders = val;
                              return { ...prev, permissions: updated };
                            });
                          }}
                          className="mt-0.5 w-5 h-5 rounded text-forest-green accent-forest-green cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                              {p.label}
                            </strong>
                            {isPos && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold text-forest-green">
                                POS Permission
                              </span>
                            )}
                            {p.key === 'admin_management' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Sensitive
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isChecked ? 'bg-emerald/10 text-emerald' : 'bg-gray-100 dark:bg-dark-border text-gray-400'
                          }`}>
                            {isChecked ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
              <button
                type="button"
                onClick={() => setPermissionModal(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors"
              >
                Cancel
              </button>
              {!(permissionModal.admin.isSuperAdmin || ['Kavin', 'Ashok Kumar'].includes(permissionModal.admin.name) || permissionModal.admin.mobile === '8489107668') && (
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions || !isSuperAdmin}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50"
                >
                  {savingPermissions ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Permissions</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAFF MANAGEMENT MODALS */}
      {/* ========================================================================= */}

      {/* 0. View Staff Details Modal */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-forest-green text-gold flex items-center justify-center font-bold text-lg shadow-sm">
                  {selectedStaffDetail.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                      {selectedStaffDetail.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedStaffDetail.status === 'Active'
                        ? 'bg-emerald/10 text-emerald border border-emerald/30'
                        : 'bg-red-50 text-red-600 border border-red-200'
                    }`}>
                      {selectedStaffDetail.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-500">
                    Staff ID: <strong className="text-forest-green dark:text-gold font-bold">{selectedStaffDetail.staffId || ('AKE-STF-' + (selectedStaffDetail._id ? String(selectedStaffDetail._id).slice(-3).toUpperCase() : '001'))}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contact & Account Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 dark:bg-dark-bg p-4 rounded-2xl border border-gray-200 dark:border-dark-border">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Mobile Number</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  +91 {selectedStaffDetail.mobile || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Email Address</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                  {selectedStaffDetail.email || 'None attached'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Username</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  @{selectedStaffDetail.username || 'staff_' + (selectedStaffDetail.mobile || '').slice(-4)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Role</span>
                <span className="font-semibold text-forest-green dark:text-gold">
                  Staff (Counter / POS)
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Date Created</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">
                  {selectedStaffDetail.createdAt
                    ? new Date(selectedStaffDetail.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Lifetime Sales & Performance KPIs */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold-light">
                Lifetime Performance Summary
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-forest-green/5 dark:bg-dark-bg p-3 rounded-xl border border-forest-green/20">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Sales</span>
                  <strong className="text-sm font-mono text-forest-green dark:text-gold block">
                    ₹{(selectedStaffDetail.totalSales || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="bg-forest-green/5 dark:bg-dark-bg p-3 rounded-xl border border-forest-green/20">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Transactions</span>
                  <strong className="text-sm font-mono text-gray-800 dark:text-gray-200 block">
                    {selectedStaffDetail.transactionCount || 0}
                  </strong>
                </div>
                <div className="bg-forest-green/5 dark:bg-dark-bg p-3 rounded-xl border border-forest-green/20">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Quantity Sold</span>
                  <strong className="text-sm font-mono text-gray-800 dark:text-gray-200 block">
                    {(selectedStaffDetail.totalQuantityKg || 0).toLocaleString('en-IN')} KG
                  </strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="bg-emerald/5 dark:bg-dark-bg p-2.5 rounded-xl border border-emerald/20">
                  <span className="text-[10px] font-bold text-emerald uppercase block">Cash Sales</span>
                  <strong className="text-xs font-mono text-emerald block">
                    ₹{(selectedStaffDetail.cashSales || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="bg-sky-50 dark:bg-sky-950/30 p-2.5 rounded-xl border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase block">UPI Sales</span>
                  <strong className="text-xs font-mono text-sky-600 dark:text-sky-400 block">
                    ₹{(selectedStaffDetail.upiSales || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Assigned Permissions List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold-light">
                Assigned Permissions
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border">
                  <div>
                    <span className="font-bold text-gray-800 dark:text-gray-200 block">POS Counter Billing (sales_pos)</span>
                    <span className="text-[10px] text-gray-400">Can access counter billing interface at /pos</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedStaffDetail.permissions?.sales_pos !== false
                      ? 'bg-emerald/10 text-emerald'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {selectedStaffDetail.permissions?.sales_pos !== false ? 'Granted' : 'Revoked'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border">
                  <div>
                    <span className="font-bold text-gray-800 dark:text-gray-200 block">View Own Sales History (view_own_sales)</span>
                    <span className="text-[10px] text-gray-400">Can view own sales history and transaction ledger</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedStaffDetail.permissions?.view_own_sales !== false
                      ? 'bg-emerald/10 text-emerald'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {selectedStaffDetail.permissions?.view_own_sales !== false ? 'Granted' : 'Revoked'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border">
                  <div>
                    <span className="font-bold text-gray-800 dark:text-gray-200 block">View Customer Contact Info (view_customer_info)</span>
                    <span className="text-[10px] text-gray-400">Can view customer phone numbers and addresses</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedStaffDetail.permissions?.view_customer_info === true
                      ? 'bg-emerald/10 text-emerald'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedStaffDetail.permissions?.view_customer_info === true ? 'Granted' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const staffId = selectedStaffDetail._id;
                  setSelectedStaffDetail(null);
                  setSelectedReportStaff(staffId);
                  setActiveReportTab('reports');
                  setActivePanel('pos-reports');
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>View Full Sales Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Add Staff Modal */}
      {createStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Add Staff Member
                  </h3>
                  <p className="text-xs text-gray-500">Authorize new staff account with granular permissions.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateStaffModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anand Kumar"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Staff ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto: e.g. AKE-STF-001"
                    value={newStaffForm.staffId || ''}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, staffId: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number * (Login Identifier)
                </label>
                <div className="flex rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden focus-within:border-gold">
                  <div className="px-3 py-2.5 bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border text-xs font-bold text-gray-600 dark:text-gray-300">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={newStaffForm.mobile}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2.5 bg-transparent text-sm font-semibold tracking-wider focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. anand_pos"
                    value={newStaffForm.username}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="staff@akerice.com"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Password / PIN * (Min 6 Characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Granular Permissions Section */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Assign Staff Permissions
                </label>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-forest-green/5 border border-forest-green/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStaffForm.sales_pos}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, sales_pos: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-forest-green dark:text-gold block">
                        POS / Counter Billing Access (sales_pos)
                      </span>
                      <span className="text-[10px] text-gray-500">Allows offline billing and receipt generation</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-forest-green/5 border border-forest-green/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStaffForm.view_own_sales}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, view_own_sales: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-forest-green dark:text-gold block">
                        View Own Sales History (view_own_sales)
                      </span>
                      <span className="text-[10px] text-gray-500">Allows staff to view their daily billed totals</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStaffForm.view_customer_info}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, view_customer_info: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300 block">
                        View Customer Phone & Contact (view_customer_info)
                      </span>
                      <span className="text-[10px] text-gray-400">Restricted permission for customer contact privacy</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-[11px] text-gray-500 space-y-1">
                <div className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-gold" />
                  <span>Strict Security & Access Control:</span>
                </div>
                <p>
                  Staff log in directly at <strong className="font-mono text-forest-green dark:text-gold">/pos</strong>. They will never receive Admin privileges and are strictly blocked (403 Forbidden) from accessing the Admin Dashboard.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateStaffModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStaffSubmitting || !newStaffForm.name.trim() || newStaffForm.mobile.replace(/\D/g, '').length !== 10 || !newStaffForm.password}
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {createStaffSubmitting ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Staff Modal */}
      {editStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-forest-green/10 text-forest-green dark:text-gold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Edit Staff: {editStaffModal.name}
                  </h3>
                  <p className="text-xs text-gray-500">Update staff details and access configuration.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditStaffModal(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffModal.name}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AKE-STF-001"
                    value={editStaffModal.staffId || ''}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, staffId: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number *
                </label>
                <div className="flex rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden focus-within:border-gold">
                  <div className="px-3 py-2.5 bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border text-xs font-bold text-gray-600 dark:text-gray-300">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editStaffModal.mobile}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2.5 bg-transparent text-sm font-semibold tracking-wider focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editStaffModal.username || ''}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editStaffModal.status || 'Active'}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-semibold"
                  >
                    <option value="Active">Active (Permitted)</option>
                    <option value="Disabled">Disabled (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editStaffModal.email || ''}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Granular Permissions Checkboxes */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Manage Permissions
                </label>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-forest-green/5 border border-forest-green/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editStaffModal.sales_pos !== false}
                      onChange={(e) => setEditStaffModal({ ...editStaffModal, sales_pos: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-forest-green dark:text-gold block">
                        POS / Counter Billing Access (sales_pos)
                      </span>
                      <span className="text-[10px] text-gray-500">Allows offline billing and receipt generation</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-forest-green/5 border border-forest-green/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editStaffModal.view_own_sales !== false}
                      onChange={(e) => setEditStaffModal({ ...editStaffModal, view_own_sales: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-forest-green dark:text-gold block">
                        View Own Sales History (view_own_sales)
                      </span>
                      <span className="text-[10px] text-gray-500">Allows staff to view their daily billed totals</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editStaffModal.view_customer_info === true}
                      onChange={(e) => setEditStaffModal({ ...editStaffModal, view_customer_info: e.target.checked })}
                      className="w-4 h-4 rounded text-forest-green accent-forest-green cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300 block">
                        View Customer Phone & Contact (view_customer_info)
                      </span>
                      <span className="text-[10px] text-gray-400">Restricted permission for customer contact privacy</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditStaffModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStaffSubmitting || !editStaffModal.name.trim() || editStaffModal.mobile.replace(/\D/g, '').length !== 10}
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editStaffSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Reset Staff Credentials Modal */}
      {resetStaffPassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light">
                    Reset POS Credentials
                  </h3>
                  <p className="text-xs text-gray-500">Staff: <strong>{resetStaffPassModal.name}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetStaffPassModal(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetStaffAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  New Password / PIN * (Min 6 Characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new credentials"
                  value={resetStaffPassValue}
                  onChange={(e) => setResetStaffPassValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <p className="text-xs text-gray-500">
                Staff member will use this new password along with their registered mobile number (+91 {resetStaffPassModal.mobile}) to log in.
              </p>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetStaffPassModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetStaffPassSubmitting || resetStaffPassValue.length < 6}
                  className="px-6 py-2.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {resetStaffPassSubmitting ? 'Updating...' : 'Update Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Revoke / Deactivate Confirmation Modal */}
      {deleteStaffConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-red-500/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-border">
              <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="brand-font text-lg font-bold text-red-600 dark:text-red-400">
                  Revoke Staff POS Access
                </h3>
                <p className="text-xs text-gray-500">Staff Member: <strong>{deleteStaffConfirmModal.name}</strong></p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Are you sure you want to revoke access and deactivate POS staff account for <strong className="text-forest-green dark:text-gold">{deleteStaffConfirmModal.name}</strong> (+91 {deleteStaffConfirmModal.mobile})?
              </p>

              <div className="p-4 rounded-2xl bg-emerald/10 border border-emerald/30 space-y-1">
                <div className="font-bold text-emerald flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Historical Sales Strictly Preserved:</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-[11px]">
                  All historical sales records, customer invoices, and reporting metrics previously entered by this staff member will remain <strong>100% intact, credited, and auditable</strong> in all business and POS reports.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-1">
                <div className="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Access Immediately Terminated:</span>
                </div>
                <p className="text-red-600 dark:text-red-400 text-[11px]">
                  The account status will be set to Disabled and POS permissions revoked immediately. Future login attempts will return 403 Forbidden.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteStaffConfirmModal(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={deletingStaff}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {deletingStaff ? 'Revoking...' : 'Revoke POS Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={!!lightboxImg}
        src={lightboxImg}
        title="Admin Image View"
        onClose={() => setLightboxImg(null)}
      />

    </div>
  );
}
