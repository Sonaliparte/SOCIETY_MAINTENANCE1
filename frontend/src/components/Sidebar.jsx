import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  Receipt, 
  CreditCard, 
  FileText, 
  Megaphone, 
  Wrench, 
  LogOut,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const adminLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/flats', label: 'Flats & Wings', icon: Building2 },
    { to: '/billing', label: 'Billing Manager', icon: Receipt },
    { to: '/expenses', label: 'Expense Tracker', icon: CreditCard },
    { to: '/notices', label: 'Notice Board', icon: Megaphone },
    { to: '/complaints', label: 'Complaints', icon: Wrench },
  ];

  const residentLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bills', label: 'Pay Bills', icon: CreditCard },
    { to: '/receipts', label: 'Receipts Ledger', icon: FileText },
    { to: '/notices', label: 'Notice Board', icon: Megaphone },
    { to: '/complaints', label: 'Complaints', icon: Wrench },
  ];

  const links = isAdmin ? adminLinks : residentLinks;

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
            <Building2 className="h-6 w-6 text-sky-400" />
            <span className="font-sans font-bold text-lg text-white leading-tight">
              SOCIETY<span className="text-sky-400"> MANAGER</span>
            </span>
          </div>
          <button 
            onClick={toggleSidebar}
            className="rounded p-1 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card info */}
        <div className="p-6 border-b border-slate-800/60 bg-slate-950/40">
          <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{user?.email}</div>
          <div className="mt-2 inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-sky-400 border border-sky-900/35">
            {user?.role === 'super_admin' ? 'Secretary' : 'Resident'}
          </div>
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
