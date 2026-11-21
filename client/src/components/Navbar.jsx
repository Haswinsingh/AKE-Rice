import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Sun, Moon, ShoppingBag, User, 
  LogOut, ChevronDown, Shield, Phone,
  FileText, Users, MessageSquare, Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isPosStaff, isSuperAdmin, hasPermission, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dropdownRef = useRef(null);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About Us', path: '/about' },
    { name: 'Our Rice', path: '/order' },
    { name: 'Recipes', path: '/recipes' },
    { name: 'Reviews', path: '/feedback' },
    { name: 'Contact', path: '/about#contact' },
  ];

  const isActive = (path) => {
    if (path.includes('#')) {
      return location.pathname === path.split('#')[0] && location.hash === `#${path.split('#')[1]}`;
    }
    return location.pathname === path;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#fbf9f4]/95 dark:bg-[#0f1713]/95 backdrop-blur-md border-b border-gold/20 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand Identity */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-gold/40 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
              <img src="/assets/logo.jpg" alt="AKE Rice Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-serif block text-xl sm:text-2xl font-bold tracking-wider text-forest-green dark:text-gold-light leading-none">
                AKE RICE
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-dark dark:text-gold block mt-0.5">
                Authentic Koppampatty Rice
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative py-1 text-sm font-semibold tracking-wide transition-colors duration-200 ${
                  isActive(link.path)
                    ? 'text-forest-green dark:text-gold font-bold after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gold'
                    : 'text-gray-700 hover:text-forest-green dark:text-gray-300 dark:hover:text-gold'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Action Tools: Cart, Theme Toggle, User Account, Order Now */}
          <div className="hidden sm:flex items-center gap-4">
            
            {/* Direct WhatsApp Callout */}
            <a
              href="https://wa.me/919176049099"
              target="_blank"
              rel="noreferrer"
              className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-forest-green/80 hover:text-forest-green dark:text-gray-300 dark:hover:text-gold transition-colors"
              title="Customer WhatsApp Helpline"
            >
              <Phone className="w-3.5 h-3.5 text-gold-dark dark:text-gold" />
              <span>+91 91760 49099</span>
            </a>

            {/* Shopping Cart Link */}
            <Link
              to="/order"
              className="p-2 text-forest-green hover:text-gold transition-colors dark:text-gray-300 dark:hover:text-gold"
              title="View Cart & Products"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 hover:text-gold transition-colors dark:text-gray-300"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-gold" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Customer / Admin / Staff Account Dropdown */}
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gold/30 hover:border-gold/60 text-xs font-bold text-forest-green dark:text-gold transition-colors bg-white/50 dark:bg-dark-card/50 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-gold" />
                  <span className="max-w-[100px] truncate">{user?.name || (isAdmin ? 'Admin' : isPosStaff ? 'POS Staff' : 'My Account')}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-gold/30 py-2 z-50 animate-in fade-in zoom-in-95">
                    {/* User Header */}
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-dark-border text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                        {user?.name || (isAdmin ? 'Administrator' : isPosStaff ? 'POS Staff' : 'Customer')}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{user?.email || (user?.mobile ? `+91 ${user.mobile}` : '')}</div>
                      {isAdmin && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-[10px] font-bold">
                          <Shield className="w-2.5 h-2.5" />
                          <span>{isSuperAdmin ? 'Super Administrator' : 'Administrator'}</span>
                        </div>
                      )}
                      {isPosStaff && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-green/10 text-forest-green dark:text-gold text-[10px] font-bold">
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span>POS Counter Staff</span>
                        </div>
                      )}
                    </div>

                    {/* Customer Account: My Account & Orders */}
                    {!isAdmin && !isPosStaff && (
                      <Link
                        to="/account"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-gold shrink-0" />
                        <span>My Account & Orders</span>
                      </Link>
                    )}

                    {/* Admin Account: Admin Dashboard & Quick Navigation */}
                    {isAdmin && (
                      <div className="py-1">
                        <Link
                          to="/admin"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-forest-green dark:text-gold hover:bg-gold/15 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5 text-gold shrink-0" />
                          <span>Admin Dashboard</span>
                        </Link>

                        {(isSuperAdmin || hasPermission('reports')) && (
                          <Link
                            to="/admin?panel=reports"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span>Business Reports</span>
                          </Link>
                        )}

                        {(isSuperAdmin || hasPermission('products')) && (
                          <Link
                            to="/admin?panel=products"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold transition-colors"
                          >
                            <Package className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span>Product Management</span>
                          </Link>
                        )}

                        {(isSuperAdmin || hasPermission('feedback')) && (
                          <Link
                            to="/admin?panel=feedback"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span>Feedback Management</span>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* POS Staff Account: POS Dashboard */}
                    {isPosStaff && (
                      <Link
                        to="/pos"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-forest-green dark:text-gold hover:bg-gold/15 transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-gold shrink-0" />
                        <span>POS Dashboard</span>
                      </Link>
                    )}

                    <div className="pt-1 mt-1 border-t border-gray-100 dark:border-dark-border">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                          navigate('/');
                        }}
                        className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold hover:text-gold-dark transition-colors px-2 py-1"
                title="Customer Sign In"
              >
                <User className="w-4 h-4 text-gold-dark dark:text-gold" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Order Now CTA Button */}
            <Link
              to="/order"
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-forest-green hover:bg-deep-green text-gold-light border border-gold/40 shadow-sm transition-all duration-200"
            >
              Order Now
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/order"
              className="p-2 text-forest-green dark:text-gold"
              title="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-300"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-gold" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-forest-green hover:bg-gold/10 dark:text-gold-light"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gold/20 bg-[#fbf9f4] dark:bg-[#0f1713] px-5 py-6 space-y-4 shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-colors ${
                  isActive(link.path)
                    ? 'text-forest-green dark:text-gold font-bold bg-gold/15'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-gold/10'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t border-gold/20 flex flex-col gap-3">
            {isAuthenticated ? (
              <div className="space-y-2">
                {/* User Info Header on Mobile */}
                <div className="px-3 py-2 bg-gold/10 rounded-xl text-xs">
                  <div className="font-bold text-gray-900 dark:text-white truncate">
                    {user?.name || (isAdmin ? 'Administrator' : isPosStaff ? 'POS Staff' : 'Customer')}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || (user?.mobile ? `+91 ${user.mobile}` : '')}
                  </div>
                </div>

                {/* Customer Account: My Account & Orders */}
                {!isAdmin && !isPosStaff && (
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gold/10 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4 text-gold" />
                    <span>My Account & Orders</span>
                  </Link>
                )}

                {/* Admin Account Quick Navigation */}
                {isAdmin && (
                  <div className="space-y-1">
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-forest-green dark:text-gold hover:bg-gold/10 rounded-xl transition-colors"
                    >
                      <Shield className="w-4 h-4 text-gold shrink-0" />
                      <span>Admin Dashboard</span>
                    </Link>

                    {(isSuperAdmin || hasPermission('reports')) && (
                      <Link
                        to="/admin?panel=reports"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold rounded-xl transition-colors"
                      >
                        <FileText className="w-4 h-4 text-gold shrink-0" />
                        <span>Business Reports</span>
                      </Link>
                    )}

                    {(isSuperAdmin || hasPermission('products')) && (
                      <Link
                        to="/admin?panel=products"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold rounded-xl transition-colors"
                      >
                        <Package className="w-4 h-4 text-gold shrink-0" />
                        <span>Product Management</span>
                      </Link>
                    )}

                    {(isSuperAdmin || hasPermission('feedback')) && (
                      <Link
                        to="/admin?panel=feedback"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gold/10 hover:text-forest-green dark:hover:text-gold rounded-xl transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-gold shrink-0" />
                        <span>Feedback Management</span>
                      </Link>
                    )}
                  </div>
                )}

                {/* POS Staff Account: POS Dashboard */}
                {isPosStaff && (
                  <Link
                    to="/pos"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-forest-green dark:text-gold hover:bg-gold/10 rounded-xl transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 text-gold shrink-0" />
                    <span>POS Dashboard</span>
                  </Link>
                )}

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    navigate('/');
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gold/40 text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold hover:bg-gold/10 transition-colors"
              >
                <User className="w-4 h-4 text-gold" />
                <span>Sign In to Account</span>
              </Link>
            )}

            <Link
              to="/order"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
            >
              <ShoppingBag className="w-4 h-4 text-gold" />
              <span>Order Rice Now</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
