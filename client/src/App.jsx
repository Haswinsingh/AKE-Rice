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
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/login" element={<LoginPage />} />
                  <Route path="/admin/pos" element={<Navigate to="/admin?panel=sales-entry" replace />} />
                  <Route path="/pos" element={<Navigate to="/admin?panel=sales-entry" replace />} />
                  <Route path="/pos-dashboard" element={<Navigate to="/admin?panel=sales-entry" replace />} />
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
