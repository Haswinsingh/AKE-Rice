import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, QrCode, Upload, CheckCircle2, 
  Copy, Phone, ShieldCheck, AlertCircle, ArrowRight, X, ExternalLink, Package, User
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { adminService } from '../services/adminService';
import { productService } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LightboxModal from '../components/LightboxModal';

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const initialParam = searchParams.get('product') || '1kg';
  const initialQtyParam = parseInt(searchParams.get('qty') || '1', 10);
  const [productsList, setProductsList] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [product, setProduct] = useState('1 KG Rice');
  const [qty, setQty] = useState(initialQtyParam > 0 ? initialQtyParam : 1);

  useEffect(() => {
    const q = parseInt(searchParams.get('qty') || '0', 10);
    if (q > 0) setQty(q);
  }, [searchParams]);

  // Customer form inputs (Open to public, no login required)
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [area, setArea] = useState(user?.addresses?.[0]?.area || '');
  const [address, setAddress] = useState(user?.addresses?.[0]?.fullAddress || '');
  const [notes, setNotes] = useState('');

  // Payment
  const [paymentType, setPaymentType] = useState('Cash'); // 'Cash' or 'Online'
  const [utr, setUtr] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  // State & Confirmation Modal
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Load products dynamically from database
  useEffect(() => {
    productService.getProducts()
      .then(res => {
        if (res.success && res.products && res.products.length > 0) {
          setProductsList(res.products);
          const matched = res.products.find(p => p.id === initialParam || p.id.includes(initialParam)) || res.products[0];
          setSelectedProduct(matched);
          setProduct(matched.name);
        }
      })
      .catch(() => {});
  }, [initialParam]);

  // Dynamic price calculation
  const is25kg = (selectedProduct?.name || product).includes('25') || selectedProduct?.id === '25kg';
  const unitPrice = selectedProduct?.price !== undefined ? selectedProduct.price : (is25kg ? 4625 : 195);
  const rate = selectedProduct?.ratePerKg !== undefined ? selectedProduct.ratePerKg : (is25kg ? 185 : 195);
  const total = qty * unitPrice;

  // Inventory availability calculations
  const currentUnitWeight = selectedProduct?.unitWeightKg || (is25kg ? 25 : 1);
  const currentAvailableKg = selectedProduct?.availableStockKg !== undefined ? selectedProduct.availableStockKg : 5000;
  const currentRequestedKg = qty * currentUnitWeight;
  const isCurrentProductOut = selectedProduct?.stockStatus === 'OUT OF STOCK' || currentAvailableKg <= 0 || selectedProduct?.status === 'Inactive';
  const isExceedingStock = currentRequestedKg > currentAvailableKg;

  const upiId = 'kaviyansellappan15@oksbi';
  const upiUri = `upi://pay?pa=${upiId}&pn=AKE%20Rice&am=${total}&cu=INR`;

  // Pre-fill user profile if logged in
  useEffect(() => {
    if (user) {
      if (!name && user.name) setName(user.name);
      if (!mobile && user.mobile) setMobile(user.mobile);
      if (!address && user.addresses?.[0]?.fullAddress) {
        setAddress(user.addresses[0].fullAddress);
        setArea(user.addresses[0].area);
      }
    }
  }, [user]);

  // Handle Screenshot selection & upload
  const handleScreenshotChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploadingScreenshot(true);
      const res = await adminService.uploadFile(file);
      if (res.success && res.fileUrl) {
        setScreenshotFile(res.fileUrl);
        showToast('Payment screenshot attached successfully!', 'success');
      }
    } catch (err) {
      showToast('Failed to upload screenshot. Please retry.', 'error');
    } finally {
      setUploadingScreenshot(false);
    }
  };

  // Submit Order
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !mobile.trim() || !area.trim() || !address.trim()) {
      showToast('Please fill out all delivery information fields.', 'error');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (isCurrentProductOut) {
      showToast('Selected product is currently out of stock. Please select another variety.', 'error');
      return;
    }

    if (isExceedingStock) {
      showToast(`Requested quantity (${currentRequestedKg} KG) exceeds available inventory of ${currentAvailableKg} KG.`, 'error');
      return;
    }

    if (paymentType === 'Online') {
      if (!utr.trim()) {
        showToast('Please enter the UTR / UPI Transaction Reference Number.', 'error');
        return;
      }
      if (!screenshotFile) {
        showToast('Please upload your payment confirmation screenshot.', 'error');
        return;
      }
    }

    try {
      setSubmitting(true);
      const orderPayload = {
        name: name.trim(),
        mobile: cleanMobile,
        area: area.trim(),
        address: address.trim(),
        product: selectedProduct?.name || product,
        productId: selectedProduct?.id || (is25kg ? '25kg' : '1kg'),
        qty,
        paymentType,
        utr: paymentType === 'Online' ? utr.trim() : undefined,
        screenshot: paymentType === 'Online' ? screenshotFile : undefined,
        notes: notes.trim()
      };

      const res = await orderService.createOrder(orderPayload);

      if (res.success && res.order) {
        setConfirmedOrder(res);
        showToast(`Order ${res.order.id} placed successfully!`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Copy WhatsApp text to clipboard
  const copyWaText = () => {
    if (!confirmedOrder?.whatsappText) return;
    navigator.clipboard.writeText(confirmedOrder.whatsappText)
      .then(() => showToast('Order details copied to clipboard!', 'info'))
      .catch(() => showToast('Could not copy automatically.', 'error'));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      
      {/* PAGE HEADER */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
          Online & WhatsApp Storefront
        </span>
        <h1 className="brand-font text-3xl sm:text-5xl font-bold text-forest-green dark:text-gold-light">
          Order Authentic Koppampatty Rice
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
          Direct farm-fresh delivery across Tamil Nadu with Cash on Delivery or Instant UPI Payment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* LEFT COLUMN: PRODUCT SELECTION & DELIVERY DETAILS */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* STEP 1: SELECT PRODUCT & QUANTITY */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-lg space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-border">
              <span className="w-8 h-8 rounded-full bg-forest-green text-gold-light font-bold flex items-center justify-center text-sm">1</span>
              <h2 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">Select Variety & Quantity</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productsList.length > 0 ? (
                productsList.map(p => {
                  const isSelected = selectedProduct?.id === p.id || product === p.name;
                  const imgSrc = p.image?.startsWith('http') || p.image?.startsWith('/') ? p.image : `/${p.image || 'assets/packet_1kg.jpg'}`;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setProduct(p.name);
                      }}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-gold bg-gold/10 dark:bg-gold/15 shadow-md'
                          : 'border-gray-200 dark:border-dark-border hover:border-gold/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={imgSrc} alt={p.name} className="w-14 h-14 object-cover rounded-xl shadow-sm" />
                        <div>
                          <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">{p.name}</strong>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{p.packageSize}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-dark-border flex items-center justify-between">
                        <span className="text-xs text-gray-500">Price:</span>
                        <div className="text-right">
                          <strong className="text-lg font-extrabold text-forest-green dark:text-gold">₹{p.price?.toLocaleString('en-IN')}</strong>
                          {p.unitWeightKg > 1 && (
                            <span className="block text-[10px] text-emerald font-semibold">₹{p.ratePerKg} / KG</span>
                          )}
                        </div>
                      </div>

                      {/* Stock availability badge */}
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-dark-border flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Availability:</span>
                        {p.status === 'Inactive' || (p.availableStockKg !== undefined && p.availableStockKg <= 0) || p.stockStatus === 'OUT OF STOCK' ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                            Out of Stock
                          </span>
                        ) : (p.availableStockKg !== undefined && p.availableStockKg <= (p.lowStockThresholdKg || 200)) || p.stockStatus === 'LOW STOCK' ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                            Low Stock ({p.availableStockKg} KG)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald/10 px-2 py-0.5 rounded-full">
                            In Stock ({p.availableStockKg !== undefined ? p.availableStockKg : 5000} KG)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div
                    onClick={() => {
                      setProduct('1 KG Rice');
                      setSelectedProduct({ id: '1kg', name: '1 KG Rice', price: 195, ratePerKg: 195, unitWeightKg: 1 });
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      product === '1 KG Rice'
                        ? 'border-gold bg-gold/10 dark:bg-gold/15 shadow-md'
                        : 'border-gray-200 dark:border-dark-border hover:border-gold/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src="/assets/packet_1kg.jpg" alt="1 KG" className="w-14 h-14 object-cover rounded-xl" />
                      <div>
                        <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">1 KG Zipper Pouch</strong>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Home feast aroma pack</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-dark-border flex items-center justify-between">
                      <span className="text-xs text-gray-500">Price:</span>
                      <strong className="text-lg font-extrabold text-forest-green dark:text-gold">₹195 / KG</strong>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setProduct('25 KG Rice');
                      setSelectedProduct({ id: '25kg', name: '25 KG Rice', price: 4625, ratePerKg: 185, unitWeightKg: 25 });
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      product === '25 KG Rice'
                        ? 'border-gold bg-gold/10 dark:bg-gold/15 shadow-md'
                        : 'border-gray-200 dark:border-dark-border hover:border-gold/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src="/assets/packet_25kg.jpg" alt="25 KG" className="w-14 h-14 object-cover rounded-xl" />
                      <div>
                        <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">25 KG Bulk Bag</strong>
                        <span className="text-xs text-emerald font-semibold">Wholesale: ₹185 / KG</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-dark-border flex items-center justify-between">
                      <span className="text-xs text-gray-500">Bag Price:</span>
                      <strong className="text-lg font-extrabold text-forest-green dark:text-gold">₹4,625 / Bag</strong>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Number of {is25kg ? '25 KG Bags' : '1 KG Pouches'}:
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gold/20 dark:bg-dark-border font-bold text-lg text-forest-green dark:text-gold transition-colors flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-12 text-center text-lg font-extrabold text-forest-green dark:text-white">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gold/20 dark:bg-dark-border font-bold text-lg text-forest-green dark:text-gold transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Live Stock Validation Indicator */}
            {isCurrentProductOut ? (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>Selected variety is currently OUT OF STOCK. Please choose another package size.</span>
              </div>
            ) : isExceedingStock ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Requested quantity ({currentRequestedKg} KG) exceeds available inventory ({currentAvailableKg} KG). Please reduce order quantity.</span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald/5 border border-emerald/20 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                <span>Selected weight: <strong className="text-forest-green dark:text-gold">{currentRequestedKg} KG</strong></span>
                <span className="text-emerald font-semibold">Available Stock: <strong>{currentAvailableKg} KG</strong></span>
              </div>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-lg text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-green/10 text-forest-green dark:text-gold flex items-center justify-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-xl font-bold text-forest-green dark:text-gold-light">
                  Sign In to Complete Your Order
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Please sign in with your email address to enter delivery details and choose your payment method. Your selected variety (<strong className="text-forest-green dark:text-gold">{selectedProduct?.name || product}</strong>) and quantity (<strong className="text-forest-green dark:text-gold">{qty}</strong>) will be preserved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const pId = selectedProduct?.id || (is25kg ? '25kg' : '1kg');
                  navigate(`/login?redirect=${encodeURIComponent(`/order?product=${pId}&qty=${qty}`)}`);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider border border-gold/40 shadow-sm transition-all cursor-pointer"
              >
                <span>Sign In & Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4 text-gold" />
              </button>
            </div>
          ) : (
            <>
              {/* STEP 2: DELIVERY ADDRESS */}
              <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-lg space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-border">
              <span className="w-8 h-8 rounded-full bg-forest-green text-gold-light font-bold flex items-center justify-center text-sm">2</span>
              <h2 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">Delivery Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kavin Sellappan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 8489107668"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Delivery Area / District *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Koppampatty / Tiruchirappalli / Chennai"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call before delivery, landmark"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Complete Street Address & Landmark *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Door No, Street Name, Landmark, Postcode"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {/* STEP 3: PAYMENT METHOD */}
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-lg space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-border">
              <span className="w-8 h-8 rounded-full bg-forest-green text-gold-light font-bold flex items-center justify-center text-sm">3</span>
              <h2 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">Payment Protocol</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* COD */}
              <label
                onClick={() => setPaymentType('Cash')}
                className={`p-4 rounded-2xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                  paymentType === 'Cash'
                    ? 'border-gold bg-gold/10 dark:bg-gold/15 shadow-sm'
                    : 'border-gray-200 dark:border-dark-border'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentType === 'Cash'}
                  onChange={() => setPaymentType('Cash')}
                  className="mt-1 text-gold"
                />
                <div>
                  <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">Cash on Delivery</strong>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Pay cash directly when order reaches your door.</span>
                </div>
              </label>

              {/* Online UPI */}
              <label
                onClick={() => setPaymentType('Online')}
                className={`p-4 rounded-2xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                  paymentType === 'Online'
                    ? 'border-gold bg-gold/10 dark:bg-gold/15 shadow-sm'
                    : 'border-gray-200 dark:border-dark-border'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentType === 'Online'}
                  onChange={() => setPaymentType('Online')}
                  className="mt-1 text-gold"
                />
                <div>
                  <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">Online UPI Payment</strong>
                  <span className="text-xs text-gray-500 dark:text-gray-400">GPay, PhonePe, Paytm, or BHIM QR code.</span>
                </div>
              </label>
            </div>

            {/* UPI Payment Instructions Sub-Panel */}
            {paymentType === 'Online' && (
              <div className="p-6 rounded-2xl bg-cream dark:bg-dark-bg border border-gold/40 space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* QR Code */}
                  <div className="flex-shrink-0 text-center">
                    <img
                      src="/assets/bhim_upi_qr.png"
                      alt="BHIM UPI QR Code"
                      className="w-40 h-40 object-contain rounded-xl border border-gold/40 shadow-md bg-white p-2 cursor-pointer"
                      onClick={() => setLightboxImg('/assets/bhim_upi_qr.png')}
                    />
                    <span className="text-[10px] text-gray-500 mt-1 block">Click to enlarge QR</span>
                  </div>

                  {/* UPI Details & Deep Link */}
                  <div className="space-y-3 flex-1 text-center sm:text-left">
                    <span className="text-xs font-bold uppercase tracking-wider text-gold-dark dark:text-gold">
                      Official UPI Payee
                    </span>
                    <div className="space-y-1">
                      <strong className="block text-base font-bold text-forest-green dark:text-white">AKE Rice – Ashok Kavin Rice</strong>
                      <code className="inline-block bg-white dark:bg-dark-card px-2.5 py-1 rounded-lg text-xs font-mono text-forest-green dark:text-gold border border-gold/30">
                        {upiId}
                      </code>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Scan QR or tap below to launch your UPI application directly with amount <strong>₹{total.toLocaleString('en-IN')}</strong>.
                    </p>

                    <a
                      href={upiUri}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-green text-gold-light text-xs font-bold uppercase tracking-wider hover:bg-deep-green transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Pay via UPI App</span>
                    </a>
                  </div>
                </div>

                {/* UTR & Screenshot Upload */}
                <div className="pt-4 border-t border-gold/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      UTR / Transaction ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 423985729103"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-sm focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Payment Screenshot Proof *
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gold text-xs font-bold text-forest-green dark:text-gold bg-white dark:bg-dark-card hover:bg-gold/10 transition-colors">
                        <Upload className="w-4 h-4" />
                        <span>{uploadingScreenshot ? 'Uploading...' : screenshotFile ? 'Change Screenshot' : 'Upload Receipt'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                        />
                      </label>

                      {screenshotPreview && (
                        <img
                          src={screenshotPreview}
                          alt="Proof"
                          className="w-10 h-10 object-cover rounded-lg border border-gold cursor-pointer"
                          onClick={() => setLightboxImg(screenshotPreview)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 italic">
                  * Note: Payments are verified by our team against bank transaction records before dispatch.
                </div>
              </div>
            )}
          </div>
          </>
        )}

        </div>

        {/* RIGHT COLUMN: ORDER SUMMARY & SUBMIT */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-28 bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border-2 border-gold/40 shadow-xl space-y-6">
            <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light pb-4 border-b border-gray-100 dark:border-dark-border">
              Order Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Selected Product:</span>
                <strong className="text-forest-green dark:text-white">{product}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Packaging Type:</span>
                <span>{selectedProduct?.packageSize || (is25kg ? '25 KG Woven Bulk Bag' : '1 KG Zipper Pouch')}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                <strong>{qty} {is25kg ? 'Bag(s)' : 'Unit(s)'}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Net Weight:</span>
                <strong>{qty * (selectedProduct?.unitWeightKg || (is25kg ? 25 : 1))} KG</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Payment Protocol:</span>
                <span className="font-semibold text-forest-green dark:text-gold">
                  {paymentType === 'Online' ? 'Online UPI' : 'Cash on Delivery'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Doorstep Delivery:</span>
                <span className="text-emerald font-bold">Standard Delivery Included</span>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-dark-border flex items-center justify-between">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-gray-500 font-bold">Total Bill:</span>
                  <span className="text-[11px] text-gray-400">Inclusive of all taxes</span>
                </div>
                <strong className="text-3xl font-black text-forest-green dark:text-gold">
                  ₹{total.toLocaleString('en-IN')}
                </strong>
              </div>
              {/* Live stock notification pill */}
              {isCurrentProductOut ? (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Out of Stock. Please select another package size.</span>
                </div>
              ) : isExceedingStock ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Quantity exceeds available stock ({currentAvailableKg} KG available).</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald/10 border border-emerald/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                  <span>Available in Store:</span>
                  <span className="font-bold">{currentAvailableKg} KG</span>
                </div>
              )}
            </div>

            {/* Submit or Sign In Button */}
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  const pId = selectedProduct?.id || (is25kg ? '25kg' : '1kg');
                  navigate(`/login?redirect=${encodeURIComponent(`/order?product=${pId}&qty=${qty}`)}`);
                }}
                className="w-full py-4 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-gold/40"
              >
                <User className="w-4 h-4 text-gold" />
                <span>Sign In to Continue Checkout</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || isCurrentProductOut || isExceedingStock}
                className="w-full py-4 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gold/40"
              >
                <ShoppingBag className="w-4 h-4 text-gold" />
                <span>
                  {submitting
                    ? 'Placing Order...'
                    : isCurrentProductOut
                    ? 'Item Out of Stock'
                    : isExceedingStock
                    ? `Exceeds Available Stock (${currentAvailableKg} KG)`
                    : 'Confirm & Place Order'}
                </span>
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 text-center">
              <ShieldCheck className="w-4 h-4 text-emerald" />
              <span>100% Genuine Koppampatty Seeraga Samba Guaranteed</span>
            </div>
          </div>
        </div>

      </form>

      {/* ORDER CONFIRMATION MODAL */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl max-w-lg w-full p-6 sm:p-8 border-2 border-gold shadow-2xl space-y-6 relative">
            <button
              onClick={() => setConfirmedOrder(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald/20 text-emerald flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                Order Received!
              </h3>
              <p className="text-xs text-gray-500">
                Your sequential order reference is:
              </p>
              <div className="inline-block px-4 py-1.5 rounded-full bg-gold/20 border border-gold text-forest-green dark:text-gold font-mono font-bold text-lg">
                {confirmedOrder.order.id}
              </div>
            </div>

            <div className="bg-cream dark:bg-dark-bg p-4 rounded-2xl text-xs space-y-2 border border-gold/20">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                <strong>{confirmedOrder.order.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Mobile:</span>
                <strong>+91 {confirmedOrder.order.mobile}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Items:</span>
                <strong>{confirmedOrder.order.product} × {confirmedOrder.order.qty}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Bill:</span>
                <strong className="text-forest-green dark:text-gold font-bold">₹{confirmedOrder.order.total?.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Payment Status:</span>
                <span className="font-semibold">{confirmedOrder.order.paymentStatus}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href={confirmedOrder.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 rounded-xl bg-emerald hover:bg-emerald/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Phone className="w-4 h-4 text-white" />
                <span>Open in WhatsApp & Confirm</span>
              </a>

              <button
                type="button"
                onClick={copyWaText}
                className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gold/20 dark:bg-dark-border text-forest-green dark:text-gold font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Order Message Text</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  navigate('/account');
                }}
                className="w-full py-2.5 text-center text-xs text-gray-500 hover:text-forest-green dark:hover:text-gold font-semibold"
              >
                View in My Account Orders →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={!!lightboxImg}
        src={lightboxImg}
        title="Payment Preview"
        onClose={() => setLightboxImg(null)}
      />

    </div>
  );
}
