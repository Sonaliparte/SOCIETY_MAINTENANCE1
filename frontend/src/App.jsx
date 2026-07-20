import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import LandingPage from './landing/LandingPage';

import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import FlatsManagement from './pages/FlatsManagement';
import BillingManagement from './pages/BillingManagement';
import ExpenseTracker from './pages/ExpenseTracker';
import NoticeBoard from './pages/NoticeBoard';
import Complaints from './pages/Complaints';
import MockCheckout from './pages/MockCheckout';
import SecurityDashboard from './pages/SecurityDashboard';
import PaymentCheckout from './pages/PaymentCheckout';
import PaymentSuccess from './pages/PaymentSuccess';
import MaintenanceStatus from './pages/MaintenanceStatus';
import ReceiptsLedger from './pages/ReceiptsLedger';
import PaymentHistory from './pages/PaymentHistory';
import UserProfile from './pages/UserProfile';

const LoadingScreen = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50">
    <div className="h-10 w-10 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading || !user) return <LoadingScreen />;

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <Routes>
            <Route
              path="/"
              element={
                user.role === 'super_admin' ? <AdminDashboard /> :
                user.role === 'security' ? <SecurityDashboard /> :
                <ResidentDashboard />
              }
            />
            <Route path="/notices" element={<NoticeBoard />} />
            <Route path="/complaints" element={<Complaints />} />

            <Route
              path="/flats"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <FlatsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <BillingManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <ExpenseTracker />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bills"
              element={
                <ProtectedRoute allowedRoles={['resident']}>
                  <ResidentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/maintenance"
              element={
                <ProtectedRoute allowedRoles={['resident']}>
                  <MaintenanceStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipts"
              element={
                <ProtectedRoute allowedRoles={['resident']}>
                  <ReceiptsLedger />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-history"
              element={
                <ProtectedRoute allowedRoles={['resident']}>
                  <PaymentHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const HomeGate = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  
  if (isAuthenticated) {
    return <DashboardLayout />;
  }
  
  return <LandingPage />;
};

const AppContent = () => (
  <Routes>
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      }
    />
    <Route path="/payment/mock-checkout" element={<MockCheckout />} />
    <Route
      path="/payment/checkout"
      element={
        <ProtectedRoute>
          <PaymentCheckout />
        </ProtectedRoute>
      }
    />
    <Route
      path="/payment/success"
      element={
        <ProtectedRoute>
          <PaymentSuccess />
        </ProtectedRoute>
      }
    />

    <Route path="/" element={<HomeGate />} />

    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }
    />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
