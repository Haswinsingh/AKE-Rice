import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, ShoppingBag, MessageSquare, MapPin, 
  LogOut, Star, CheckCircle2, Clock, ShieldCheck, 
  Plus, Trash2, Edit3, ChevronRight, X, Phone 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { feedbackService } from '../services/feedbackService';
import { useToast } from '../context/ToastContext';

export default function AccountPage() {
  const { user, isAuthenticated, loading: authLoading, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'feedback', 'addresses', 'profile'
  const [orders, setOrders] = useState([]);
  const [myFeedback, setMyFeedback] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  // Selected Order Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Profile Edit State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New Address State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressLabel, setAddressLabel] = useState('Home');
  const [fullAddress, setFullAddress] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?redirect=/account');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');

      // Fetch user's orders
      orderService.getOrders()
        .then(res => {
          if (res.success && res.orders) {
            setOrders(res.orders);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingOrders(false));

      // Fetch user's submitted feedback
      feedbackService.getMyFeedback()
        .then(res => {
          if (res.success && res.reviews) {
            setMyFeedback(res.reviews);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingFeedback(false));
    }
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await updateProfile({ name, email });
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!fullAddress.trim() || !area.trim()) {
      showToast('Please fill out all address fields.', 'error');
      return;
    }

    const currentAddresses = user?.addresses || [];
    const newAddressObj = {
      label: addressLabel,
      fullAddress: fullAddress.trim(),
      area: area.trim(),
      pincode: pincode.trim(),
      isDefault: currentAddresses.length === 0
    };

    try {
      await updateProfile({ addresses: [...currentAddresses, newAddressObj] });
      showToast('New delivery address added!', 'success');
      setShowAddressModal(false);
      setFullAddress('');
      setArea('');
      setPincode('');
    } catch (err) {
      showToast('Could not save address.', 'error');
    }
  };

  const handleDeleteAddress = async (index) => {
    const updated = (user?.addresses || []).filter((_, i) => i !== index);
    try {
      await updateProfile({ addresses: updated });
      showToast('Address removed.', 'info');
    } catch (err) {
      showToast('Could not remove address.', 'error');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      
      {/* USER HERO BANNER */}
      <div className="bg-gradient-to-r from-forest-green to-deep-green p-6 sm:p-10 rounded-3xl text-white border-2 border-gold/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 text-center sm:text-left">
          <div className="w-20 h-20 rounded-full border-2 border-gold bg-gold/20 flex items-center justify-center text-3xl font-bold text-gold-light overflow-hidden flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span>{user.name?.charAt(0)?.toUpperCase() || 'C'}</span>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="brand-font text-2xl sm:text-3xl font-bold text-gold-light">
              Welcome, {user.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300">
              {user.mobile ? `+91 ${user.mobile}` : user.email} • Customer Account
            </p>
            <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald/20 text-emerald-300 border border-emerald/40">
              Verified Member
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-red-600/80 text-white font-bold text-xs uppercase tracking-wider transition-colors border border-white/20"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-gold/20 gap-2 overflow-x-auto pb-1 text-sm font-bold">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl transition-colors ${
            activeTab === 'orders'
              ? 'bg-forest-green text-gold-light border-b-2 border-gold font-extrabold shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-forest-green dark:hover:text-gold'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-gold" />
          <span>My Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl transition-colors ${
            activeTab === 'feedback'
              ? 'bg-forest-green text-gold-light border-b-2 border-gold font-extrabold shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-forest-green dark:hover:text-gold'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-gold" />
          <span>My Feedback ({myFeedback.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl transition-colors ${
            activeTab === 'addresses'
              ? 'bg-forest-green text-gold-light border-b-2 border-gold font-extrabold shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-forest-green dark:hover:text-gold'
          }`}
        >
          <MapPin className="w-4 h-4 text-gold" />
          <span>Saved Addresses ({user.addresses?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl transition-colors ${
            activeTab === 'profile'
              ? 'bg-forest-green text-gold-light border-b-2 border-gold font-extrabold shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-forest-green dark:hover:text-gold'
          }`}
        >
          <User className="w-4 h-4 text-gold" />
          <span>Profile Settings</span>
        </button>
      </div>

      {/* TAB CONTENT: MY ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
              Your Purchase History
            </h3>
            <button
              onClick={() => navigate('/order')}
              className="px-4 py-2 rounded-xl bg-forest-green text-gold-light text-xs font-bold uppercase tracking-wider hover:bg-deep-green"
            >
              + Place New Order
            </button>
          </div>

          {loadingOrders ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-28 bg-white dark:bg-dark-card rounded-2xl animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-dark-card p-12 rounded-3xl border border-gold/30 text-center space-y-4">
              <ShoppingBag className="w-12 h-12 text-gold mx-auto" />
              <h4 className="font-bold text-lg text-forest-green dark:text-gold-light">No orders placed yet</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Ready to experience authentic Koppampatty Seeraga Samba? Order your first fresh 1KG pouch or 25KG sack today!
              </p>
              <button
                onClick={() => navigate('/order')}
                className="px-6 py-3 rounded-xl bg-forest-green text-gold-light font-bold text-xs uppercase tracking-wider"
              >
                Order Rice Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-forest-green dark:text-gold-light text-base">
                        {o.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        o.status === 'Delivered'
                          ? 'bg-emerald/15 text-emerald'
                          : o.status === 'Cancelled'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gold/20 text-forest-green dark:text-gold'
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      <strong>{o.product}</strong> × {o.qty} &bull; Delivery to {o.area}
                    </div>

                    <div className="text-[11px] text-gray-400">
                      Placed on {o.date || o.dateTime || 'Recently'} &bull; Payment: {o.payment} ({o.paymentStatus})
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                    <strong className="text-xl font-extrabold text-forest-green dark:text-gold">
                      ₹{o.total?.toLocaleString('en-IN')}
                    </strong>

                    <button
                      onClick={() => setSelectedOrder(o)}
                      className="px-4 py-2 rounded-xl bg-gold/15 text-forest-green dark:text-gold font-bold text-xs uppercase tracking-wider hover:bg-gold/30 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MY FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
              Your Reviews & Ratings
            </h3>
            <button
              onClick={() => navigate('/feedback')}
              className="px-4 py-2 rounded-xl bg-forest-green text-gold-light text-xs font-bold uppercase tracking-wider hover:bg-deep-green"
            >
              + Write New Feedback
            </button>
          </div>

          {loadingFeedback ? (
            <div className="space-y-3">
              {[1].map(i => <div key={i} className="h-28 bg-white dark:bg-dark-card rounded-2xl animate-pulse" />)}
            </div>
          ) : myFeedback.length === 0 ? (
            <div className="bg-white dark:bg-dark-card p-12 rounded-3xl border border-gold/30 text-center space-y-4">
              <MessageSquare className="w-12 h-12 text-gold mx-auto" />
              <h4 className="font-bold text-lg text-forest-green dark:text-gold-light">No reviews submitted yet</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Have you cooked biryani with our rice? Share your thoughts to help other home cooks!
              </p>
              <button
                onClick={() => navigate('/feedback')}
                className="px-6 py-3 rounded-xl bg-forest-green text-gold-light font-bold text-xs uppercase tracking-wider"
              >
                Write Feedback Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myFeedback.map((f) => (
                <div
                  key={f.id || f._id}
                  className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gold">
                      {[...Array(f.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                      ))}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      f.status === 'Approved'
                        ? 'bg-emerald/15 text-emerald'
                        : f.status === 'Rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gold/20 text-forest-green dark:text-gold'
                    }`}>
                      {f.status === 'Approved' ? 'Published' : f.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    "{f.review}"
                  </p>

                  <div className="text-[11px] text-gray-400">
                    Submitted on: {f.date || 'Recent'}
                  </div>

                  {f.adminResponse && (
                    <div className="p-3 rounded-xl bg-forest-green/5 dark:bg-dark-bg border border-gold/20 text-xs">
                      <strong className="text-forest-green dark:text-gold block mb-1">Reply from AKE Rice:</strong>
                      <p className="text-gray-600 dark:text-gray-300">{f.adminResponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SAVED ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
              Delivery Addresses
            </h3>
            <button
              onClick={() => setShowAddressModal(true)}
              className="px-4 py-2 rounded-xl bg-forest-green text-gold-light text-xs font-bold uppercase tracking-wider hover:bg-deep-green flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {(user?.addresses?.length || 0) === 0 ? (
            <div className="bg-white dark:bg-dark-card p-10 rounded-3xl border border-gold/30 text-center space-y-3">
              <MapPin className="w-10 h-10 text-gold mx-auto" />
              <p className="text-sm text-gray-500">No saved addresses yet.</p>
              <button
                onClick={() => setShowAddressModal(true)}
                className="px-5 py-2.5 rounded-xl bg-gold/20 text-forest-green dark:text-gold font-bold text-xs uppercase tracking-wider"
              >
                Add Delivery Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {user.addresses.map((addr, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gold/30 shadow-md space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold bg-gold/15 px-3 py-1 rounded-full">
                      {addr.label}
                    </span>
                    <button
                      onClick={() => handleDeleteAddress(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Delete Address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                    {addr.fullAddress}
                  </p>

                  <div className="text-xs text-gray-500">
                    Area: <strong>{addr.area}</strong> {addr.pincode && `• PIN: ${addr.pincode}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-dark-card p-6 sm:p-10 rounded-3xl border border-gold/30 shadow-xl max-w-xl space-y-6">
          <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light pb-4 border-b border-gray-100 dark:border-dark-border">
            Personal Profile
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                disabled
                value={user.mobile || 'Not linked'}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border text-sm text-gray-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">Mobile number is linked to your login identity.</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl max-w-lg w-full p-6 sm:p-8 border-2 border-gold shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-gold tracking-wider">Order Receipt</span>
              <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                {selectedOrder.id}
              </h3>
              <p className="text-xs text-gray-500">
                Placed on {selectedOrder.dateTime || selectedOrder.date}
              </p>
            </div>

            <div className="bg-cream dark:bg-dark-bg p-4 rounded-2xl text-xs space-y-2 border border-gold/20">
              <div className="flex justify-between">
                <span className="text-gray-500">Items:</span>
                <strong>{selectedOrder.product} (Qty: {selectedOrder.qty})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Price:</span>
                <strong className="text-forest-green dark:text-gold font-bold">₹{selectedOrder.total?.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment:</span>
                <span>{selectedOrder.payment} ({selectedOrder.paymentStatus})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Status:</span>
                <span className="font-bold text-emerald">{selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Address:</span>
                <span className="text-right max-w-xs">{selectedOrder.address}, {selectedOrder.area}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href={`https://wa.me/919176049099?text=Hello%20AKE%20Rice,%20checking%20status%20for%20order%20${selectedOrder.id}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-emerald hover:bg-emerald/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow"
              >
                <Phone className="w-4 h-4 text-white" />
                <span>Track on WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-300 font-semibold text-xs"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ADDRESS MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card rounded-3xl max-w-md w-full p-6 sm:p-8 border border-gold shadow-2xl space-y-6 relative">
            <button
              onClick={() => setShowAddressModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
              Add New Address
            </h3>

            <form onSubmit={handleAddAddress} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Label
                </label>
                <select
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                >
                  <option value="Home">Home</option>
                  <option value="Office / Shop">Office / Shop</option>
                  <option value="Restaurant / Kitchen">Restaurant / Kitchen</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Full Street Address *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Door No, Street Name, Landmark"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Area / City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tiruchirappalli"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 620001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow"
              >
                Save Delivery Address
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
