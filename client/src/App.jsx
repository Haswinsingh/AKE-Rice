import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import OrderPage from './pages/OrderPage';
import RecipesPage from './pages/RecipesPage';
import FeedbackPage from './pages/FeedbackPage';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import PosStaffDashboard from './pages/PosStaffDashboard';
import { useAuth } from './context/AuthContext';

function PosRouteWrapper() {
  const { user, isPosStaff, loading } = useAuth();
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login?redirect=/pos" replace />;
  }
  if (isPosStaff) {
    return <PosStaffDashboard />;
  }
  return <AdminPage initialPanel="sales-entry" />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-cream dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/order" element={<OrderPage />} />
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/login" element={<LoginPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/pos" element={<AdminPage initialPanel="sales-entry" />} />
                  <Route path="/pos" element={<PosRouteWrapper />} />
                  <Route path="/pos-dashboard" element={<PosStaffDashboard />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
