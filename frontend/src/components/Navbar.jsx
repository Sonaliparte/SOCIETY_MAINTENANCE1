import React from 'react';
import { Menu, Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ toggleSidebar }) => {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Global branding context indicator */}
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm font-medium text-slate-500"> Greenwood Residency Portal</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date Display */}
        <span className="hidden md:block text-xs font-medium text-slate-400">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>

        {/* Notification Bell */}
        <button className="relative rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-500"></span>
        </button>

        {/* User Initials Circle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</div>
            <div className="text-[10px] text-slate-400 font-medium">ID: {user?.id.substring(0, 8).toUpperCase()}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-between rounded-full bg-sky-100 text-sky-700 font-bold text-sm justify-center border border-sky-200 ring-2 ring-sky-50/50">
            {getInitials(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
