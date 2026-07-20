import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  FileText,
  Megaphone,
  Wrench,
  LogOut,
  X,
  Shield,
  ShieldAlert,
  History,
  Wallet,
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const adminLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/flats', label: 'Flats & Wings', icon: Shield },
    { to: '/billing', label: 'Billing Manager', icon: Receipt },
    { to: '/expenses', label: 'Expense Tracker', icon: CreditCard },
    { to: '/notices', label: 'Notice Board', icon: Megaphone },
    { to: '/complaints', label: 'Complaints', icon: Wrench },
  ];

  const residentLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/maintenance', label: 'Maintenance', icon: Wallet },
    { to: '/receipts', label: 'Receipts Ledger', icon: FileText },
    { to: '/payment-history', label: 'Payment History', icon: History },
    { to: '/notices', label: 'Notice Board', icon: Megaphone },
    { to: '/complaints', label: 'Complaints', icon: Wrench },
  ];

  const securityLinks = [
    { to: '/', label: 'Guard Panel', icon: ShieldAlert },
  ];

  const links = user?.role === 'super_admin' ? adminLinks :
                user?.role === 'security' ? securityLinks :
                residentLinks;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-screen
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <img src="/securix-logo.png" alt="SecuriX Logo" className="h-7 w-auto" />
            <span className="font-sans font-bold text-lg text-white leading-tight">
              SECURI<span className="text-sky-400">X</span>
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="rounded p-1 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>


        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => { if (window.innerWidth < 1024) toggleSidebar(); }}
                className={({ isActive }) => `
                  flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-sky-600 text-white font-semibold shadow-lg shadow-sky-950/30'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400'}
                `}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-950/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
