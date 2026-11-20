import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, ShoppingBag, Boxes, CheckCircle2, Clock, 
  RefreshCw, LogOut, ShieldAlert, ArrowRight, Printer, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminService';
import { useToast } from '../context/ToastContext';

export default function PosStaffDashboard() {
  const { user, isPosStaff, isAdmin, isSuperAdmin, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Sales Entry Form State
  const [product, setProduct] = useState('1 KG Rice'); // '1 KG Rice' or '25 KG Rice'
  const [shop, setShop] = useState('');
  const [mobile, setMobile] = useState('');
  const [area, setArea] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(195);
  const [payment, setPayment] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedSale, setLastSavedSale] = useState(null);

  // Summary Metrics & Recent Sales State
  const [todaySales, setTodaySales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Access Guard: only pos_staff, admin, or superadmin
  useEffect(() => {
    if (!authLoading && !isPosStaff && !isAdmin && !isSuperAdmin) {
      showToast('POS Staff or Administrator authorization required.', 'error');
      navigate('/login?redirect=/pos');
    }
  }, [authLoading, isPosStaff, isAdmin, isSuperAdmin, navigate]);

  // Handle rice variety selection & rate updates
  const handleProductChange = (prodName) => {
    setProduct(prodName);
    if (prodName === '25 KG Rice' || prodName.includes('25')) {
      setRate(185); // ₹185 per KG = ₹4,625 per 25 KG bag
    } else {
      setRate(195); // ₹195 per KG
    }
  };

  // Calculate live total
  const calculatedTotal = product.includes('25') 
    ? (qty * 25 * rate) 
    : (qty * rate);

  // Load today's sales for authenticated user
  const loadTodaySales = async () => {
    try {
      setLoadingSales(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await adminService.getSales({
        startDate: todayStr,
        endDate: todayStr
      });
      if (res && res.success) {
        setTodaySales(res.sales || []);
      }
    } catch (err) {
      console.warn('Failed loading sales:', err.message);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodaySales();
    }
  }, [user]);

  // Aggregate today's metrics
  const totalAmount = todaySales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalTransactions = todaySales.length;
  const totalQuantityKg = todaySales.reduce((acc, s) => {
    const is25 = s.product?.includes('25');
    return acc + (is25 ? (s.qty || 1) * 25 : (s.qty || 1));
  }, 0);
  const cashSales = todaySales
    .filter(s => (s.payment || s.paymentMethod || 'Cash').toLowerCase().includes('cash'))
    .reduce((acc, s) => acc + (s.total || 0), 0);
  const upiSales = todaySales
    .filter(s => (s.payment || s.paymentMethod || 'Cash').toLowerCase().includes('upi'))
    .reduce((acc, s) => acc + (s.total || 0), 0);

  // Submit offline POS sale
  const handleSubmitSale = async (e) => {
    e.preventDefault();
    if (!shop.trim() || !area.trim()) {
      showToast('Please enter customer/shop name and area location.', 'error');
      return;
    }

    if (qty <= 0) {
      showToast('Quantity must be at least 1.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerName: shop.trim(),
        customerMobile: mobile.trim() || undefined,
        mobile: mobile.trim() || undefined,
        phone: mobile.trim() || undefined,
        shop: shop.trim(),
        area: area.trim(),
        product,
        riceType: product,
        qty: parseInt(qty, 10),
        rate: parseFloat(rate),
        payment,
        paymentMethod: payment,
        transactionDate: date,
        date,
        notes: notes.trim()
      };

      const res = await adminService.createSale(payload);
      if (res && res.success) {
        showToast(`Transaction ${res.sale?.id || ''} recorded successfully!`, 'success');
        setLastSavedSale(res.sale);
        // Reset form fields
        setShop('');
        setMobile('');
        setArea('');
        setQty(1);
        setNotes('');
        // Reload transactions
        loadTodaySales();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record sales entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || (!isPosStaff && !isAdmin && !isSuperAdmin)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  // Check if POS access is revoked
  if (user?.status === 'Disabled' || user?.permissions?.sales_pos === false) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="brand-font text-2xl font-bold text-gray-900 dark:text-white">
            POS Terminal Access Disabled
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Your POS Staff account (<strong>{user?.name}</strong>) has been deactivated or your billing access has been revoked.
          </p>
          <p className="text-xs text-gray-400">
            Please contact the administrator or mill supervisor (+91 8489107668) to restore terminal access.
          </p>
        </div>
        <button
          onClick={logout}
          className="px-6 py-2.5 rounded-xl bg-forest-green text-gold-light font-bold text-xs uppercase tracking-wider"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      
      {/* POS TERMINAL HEADER */}
      <div className="bg-forest-green text-white p-6 sm:p-8 rounded-3xl border-2 border-gold shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gold/20 border border-gold flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-8 h-8 text-gold-light" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-gold/20 text-gold-light text-[10px] font-bold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              Terminal Online • Retail POS
            </div>
            <h1 className="brand-font text-2xl sm:text-3xl font-bold text-gold-light">
              AKE Rice POS Billing Terminal
            </h1>
            <p className="text-xs text-gray-300">
              Staff Member: <strong className="text-white font-bold">{user?.name}</strong> • Staff ID: <span className="font-mono text-gold-light">{user?.staffId || ('AKE-STF-' + String(user?.id || user?._id || '').slice(-3).toUpperCase())}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(isAdmin || isSuperAdmin) && (
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-gold/20 text-gold-light font-bold text-xs uppercase tracking-wider transition-all"
            >
              Admin Dashboard
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* TODAY'S SALES KPI METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Today Sales */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-md space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Today's Sales</span>
          <strong className="block text-2xl font-black text-forest-green dark:text-gold">
            ₹{totalAmount.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-gray-400">Total gross revenue</span>
        </div>

        {/* Transactions */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-md space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Transactions</span>
          <strong className="block text-2xl font-black text-forest-green dark:text-gold">
            {totalTransactions}
          </strong>
          <span className="text-[10px] text-emerald font-semibold">Completed receipts</span>
        </div>

        {/* Quantity Sold */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-md space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Quantity Sold</span>
          <strong className="block text-2xl font-black text-forest-green dark:text-gold">
            {totalQuantityKg} <span className="text-sm font-bold text-gray-500">KG</span>
          </strong>
          <span className="text-[10px] text-gray-400">Total weight dispatched</span>
        </div>

        {/* Cash Sales */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-md space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Cash Sales</span>
          <strong className="block text-2xl font-black text-emerald">
            ₹{cashSales.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-gray-400">Cash drawer balance</span>
        </div>

        {/* UPI Sales */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gold/30 shadow-md space-y-1 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">UPI / QR Sales</span>
          <strong className="block text-2xl font-black text-blue-600 dark:text-blue-400">
            ₹{upiSales.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-gray-400">Digital settlements</span>
        </div>

      </div>

      {/* SALES ENTRY BILLING FORM */}
      <div className="bg-white dark:bg-dark-card p-6 sm:p-10 rounded-3xl border-2 border-gold/40 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
          <div>
            <h2 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
              Record Offline Sales Entry
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Direct counter sales, restaurant orders, and bulk bag dispatches. Deducts live inventory upon save.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold/20 text-forest-green dark:text-gold border border-gold/30">
            Authenticated: {user?.name}
          </span>
        </div>

        {/* Rice Variety Toggle */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleProductChange('1 KG Rice')}
            className={`p-4 rounded-2xl font-bold text-left border transition-all cursor-pointer ${
              product === '1 KG Rice'
                ? 'bg-forest-green text-gold-light border-gold shadow-lg ring-2 ring-gold/20'
                : 'bg-cream/40 dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:border-gold'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">🌾 1 KG Retail Pouch</span>
              <span className="text-xs font-mono font-black text-gold">₹195 / KG</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Aroma-locked zipper retail consumer pack</p>
          </button>

          <button
            type="button"
            onClick={() => handleProductChange('25 KG Rice')}
            className={`p-4 rounded-2xl font-bold text-left border transition-all cursor-pointer ${
              product === '25 KG Rice'
                ? 'bg-forest-green text-gold-light border-gold shadow-lg ring-2 ring-gold/20'
                : 'bg-cream/40 dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:border-gold'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">📦 25 KG Bulk Bag</span>
              <span className="text-xs font-mono font-black text-gold">₹185 / KG • ₹4,625 / Bag</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Heavy woven master bag for catering and shops</p>
          </button>
        </div>

        <form onSubmit={handleSubmitSale} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Customer / Shop Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Customer / Shop Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Grand Biryani Hotel"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

            {/* Customer Mobile */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Customer Mobile (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

            {/* Area / Location */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Area / Location *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Salem - Fairlands"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Quantity ({product.includes('25') ? 'Bags of 25 KG' : 'Packets of 1 KG'}) *
              </label>
              <div className="flex rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-4 py-3 bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-gray-200 font-bold hover:bg-gold/20 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  required
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center font-bold text-sm focus:outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="px-4 py-3 bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-gray-200 font-bold hover:bg-gold/20 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Transaction Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Rate per KG */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Rate Per KG (₹)
              </label>
              <input
                type="number"
                disabled
                value={rate}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-gray-100 dark:bg-dark-bg text-sm font-bold text-gray-600 dark:text-gray-300 cursor-not-allowed"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Payment Method *
              </label>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold font-semibold"
              >
                <option value="Cash">Cash (Immediate Handover)</option>
                <option value="UPI">UPI / GPay / PhonePe / QR</option>
                <option value="Card">Bank Card / POS Swiped</option>
                <option value="Credit">Shop Ledger (Credit / Deferred)</option>
              </select>
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Remarks / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Wedding caterer order"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

          </div>

          {/* CALCULATED TOTAL CARD & SAVE BUTTON */}
          <div className="p-6 rounded-2xl bg-cream dark:bg-dark-bg border-2 border-gold/40 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Calculated Total Amount
              </span>
              <div className="flex items-baseline gap-2">
                <strong className="text-3xl sm:text-4xl font-black text-forest-green dark:text-gold">
                  ₹{calculatedTotal.toLocaleString('en-IN')}
                </strong>
                <span className="text-xs font-semibold text-gray-500">
                  ({product.includes('25') ? `${qty} Bags x 25 KG @ ₹${rate}/KG` : `${qty} Packets x 1 KG @ ₹${rate}/KG`})
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !shop.trim() || !area.trim()}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-sm uppercase tracking-wider shadow-xl transition-all hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Sale...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Sales Entry</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* TODAY'S RECORDED TRANSACTIONS LEDGER */}
      {user?.permissions?.view_own_sales !== false ? (
        <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-forest-green dark:text-gold-light">
                Today's Recorded Transactions ({todaySales.length})
              </h3>
              <p className="text-xs text-gray-400">
                Only displaying transactions recorded by your account ({user?.name}) today.
              </p>
            </div>
            <button
              onClick={loadTodaySales}
              className="text-xs font-bold text-forest-green dark:text-gold hover:underline flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSales ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-forest-green/10 dark:bg-dark-border text-forest-green dark:text-gold font-bold">
                <tr>
                  <th className="p-3.5">Txn ID</th>
                  <th className="p-3.5">Customer / Shop</th>
                  <th className="p-3.5">Area</th>
                  <th className="p-3.5">Rice Product</th>
                  <th className="p-3.5 text-center">Quantity</th>
                  <th className="p-3.5 text-center">Rate</th>
                  <th className="p-3.5 text-center">Payment</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {todaySales.length > 0 ? (
                  todaySales.map(s => (
                    <tr key={s._id || s.id} className="hover:bg-cream/40 dark:hover:bg-dark-border/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-forest-green dark:text-gold">
                        {s.transactionId || s.id}
                      </td>
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {s.customerName || s.shop}
                      </td>
                      <td className="p-3.5 text-gray-500">
                        {s.area}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold">{s.product}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {s.qty || s.quantity} {s.product?.includes('25') ? 'Bags (25kg)' : 'KG'}
                      </td>
                      <td className="p-3.5 text-center font-mono">
                        ₹{s.rate || s.ratePerKg}/kg
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-dark-border">
                          {s.payment || s.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-forest-green dark:text-gold text-sm">
                        ₹{(s.total || s.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald/10 text-emerald">
                          <CheckCircle2 className="w-3 h-3" />
                          {s.status || s.transactionStatus || 'Delivered'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-400 font-medium">
                      {loadingSales ? 'Loading today transactions...' : 'No sales recorded yet today. Use the billing form above to record your first transaction.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-card rounded-3xl border border-gray-200 dark:border-dark-border p-6 text-center text-xs text-gray-400">
          Individual sales ledger view restricted by administrator policy.
        </div>
      )}

    </div>
  );
}
