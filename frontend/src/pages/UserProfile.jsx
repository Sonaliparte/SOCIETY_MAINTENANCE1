import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Edit2, Check, X, Shield, Building, User, Mail, Phone, Calendar } from 'lucide-react';

const UserProfile = () => {
  const { user, updateProfileLocal } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    unit: user?.unit || '',
    moveInDate: user?.moveInDate || '',
  });

  const [notificationPrefs, setNotificationPrefs] = useState(
    user?.notificationPreferences || { email: true, sms: false }
  );

  const fileInputRef = useRef(null);
  const [errorToast, setErrorToast] = useState('');

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Please upload a valid image (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateProfileLocal({ photo: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const showError = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 3000);
  };

  const handleSaveProfile = () => {
    // Basic validation
    if (!formData.name.trim() || !formData.email.trim()) {
      showError('Name and Email are required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError('Please enter a valid email.');
      return;
    }
    
    updateProfileLocal({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      unit: formData.unit,
      moveInDate: formData.moveInDate,
    });
    setIsEditing(false);
  };

  const handlePrefToggle = (key) => {
    const newPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(newPrefs);
    updateProfileLocal({ notificationPreferences: newPrefs });
  };

  const getRoleBadge = (role) => {
    if (role === 'super_admin') return 'Secretary';
    if (role === 'security') return 'Security Guard';
    return 'Resident';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">User Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your personal information and account settings</p>
        </div>
      </div>

      {errorToast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-semibold animate-slide-in">
          {errorToast}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative group shrink-0">
          <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-white shadow-md bg-sky-50 flex items-center justify-center">
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-sky-600">{getInitials(user?.name)}</span>
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 p-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors shadow-sm ring-2 ring-white"
            title="Upload Photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/jpeg,image/png,image/webp" 
          />
        </div>

        <div className="text-center sm:text-left space-y-2 flex-1">
          <h2 className="text-2xl font-bold text-slate-900">{user?.name}</h2>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
              <Shield className="h-3.5 w-3.5 mr-1" />
              {getRoleBadge(user?.role)}
            </span>
            {user?.unit && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Building className="h-3.5 w-3.5 mr-1" />
                Unit: {user.unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Information */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-semibold text-slate-800">Personal Information</h3>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user?.name || '',
                      email: user?.email || '',
                      phone: user?.phone || '',
                      unit: user?.unit || '',
                      moveInDate: user?.moveInDate || '',
                    });
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors shadow-sm"
                >
                  <Check className="h-4 w-4" /> Save
                </button>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Full Name
              </label>
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 px-3 py-2">{user?.name || '—'}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </label>
              {isEditing ? (
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 px-3 py-2">{user?.email || '—'}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone Number
              </label>
              {isEditing ? (
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 px-3 py-2">{user?.phone || '—'}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" /> Unit / Flat Number
              </label>
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 px-3 py-2">{user?.unit || '—'}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Move-in Date
              </label>
              {isEditing ? (
                <input 
                  type="date"
                  value={formData.moveInDate}
                  onChange={(e) => setFormData({...formData, moveInDate: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-700"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 px-3 py-2">{user?.moveInDate ? new Date(user.moveInDate).toLocaleDateString() : '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account & Preferences */}
        <div className="space-y-6">
          {/* Notifications */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-800">Notifications</h3>
            </div>
            <div className="p-5 space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">Email Alerts</span>
                  <p className="text-xs text-slate-500">Maintenance dues & updates</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={notificationPrefs.email} onChange={() => handlePrefToggle('email')} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${notificationPrefs.email ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${notificationPrefs.email ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
              </label>
              
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">SMS Alerts</span>
                  <p className="text-xs text-slate-500">Urgent notices & payments</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={notificationPrefs.sms} onChange={() => handlePrefToggle('sms')} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${notificationPrefs.sms ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${notificationPrefs.sms ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
              </label>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-800">Security</h3>
            </div>
            <div className="p-5">
              <button className="w-full py-2 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
