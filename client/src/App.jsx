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
import PosPage from './pages/PosPage';
import { useAuth } from './context/AuthContext';

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
                  <Route path="/admin" element={<AdminPage isHub />} />
                  <Route path="/admin/analytics" element={<AdminPage dedicatedPanel="analytics" />} />
                  <Route path="/admin/products" element={<AdminPage dedicatedPanel="products" />} />
                  <Route path="/admin/pos" element={<Navigate to="/pos" replace />} />
                  <Route path="/admin/pos-reports" element={<AdminPage dedicatedPanel="pos-reports" />} />
                  <Route path="/admin/business-reports" element={<AdminPage dedicatedPanel="reports" />} />
                  <Route path="/admin/reports" element={<AdminPage dedicatedPanel="reports" />} />
                  <Route path="/admin/backup" element={<AdminPage dedicatedPanel="drive-backup" />} />
                  <Route path="/admin/drive-backup" element={<AdminPage dedicatedPanel="drive-backup" />} />
                  <Route path="/admin/orders" element={<AdminPage dedicatedPanel="orders" />} />
                  <Route path="/admin/feedback" element={<AdminPage dedicatedPanel="feedback" />} />
                  <Route path="/admin/management" element={<AdminPage dedicatedPanel="admin-users" />} />
                  <Route path="/admin/admin-users" element={<AdminPage dedicatedPanel="admin-users" />} />
                  <Route path="/admin/settings" element={<AdminPage dedicatedPanel="settings" />} />
                  <Route path="/pos" element={<PosPage />} />
                  <Route path="/pos-dashboard" element={<Navigate to="/pos" replace />} />
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
