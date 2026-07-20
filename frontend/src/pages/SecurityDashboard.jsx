import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  getFlats,
  logVisitorEntry,
  logVisitorExit,
  getSocietyVisitors,
  getSocietyApprovedVisitors,
  getSocietyDailyHelp,
  getSocietyHelpAttendance,
  markHelpAttendance,
  logDelivery,
  getSocietyDeliveries,
  verifyAndUseGatePass,
  getActiveSOSAlerts,
  resolveSOSAlert
} from '../services/dataService';
import {
  User,
  Phone,
  Car,
  ClipboardList,
  Search,
  Package,
  Key,
  AlertOctagon,
  Users,
  Check,
  CheckCircle,
  LogOut,
  Upload,
  UserCheck,
  Loader2,
  Clock,
  LogOut as ExitIcon
} from 'lucide-react';

const SecurityDashboard = () => {
  const { user, logout } = useAuth();
  const [flats, setFlats] = useState([]);
  const [activeTab, setActiveTab] = useState('visitors'); // visitors, deliveries, gatepass, dailyhelp, sos
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dropdown list data
  const [visitorsLog, setVisitorsLog] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [dailyHelpList, setDailyHelpList] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [activeSOS, setActiveSOS] = useState([]);

  // Form states - Visitor Log
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorFlat, setVisitorFlat] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('Guest'); // Guest, Delivery, Cab, Service
  const [visitorVehicle, setVisitorVehicle] = useState('');
  const [visitorPhotoFile, setVisitorPhotoFile] = useState(null);
  
  // Search state - Pre-approved
  const [preApprovedSearch, setPreApprovedSearch] = useState('');

  // Form states - Delivery Log
  const [courierName, setCourierName] = useState('Amazon'); // Amazon, Swiggy, Zomato, Dunzo, Other
  const [deliveryFlat, setDeliveryFlat] = useState('');
  const [deliveryDesc, setDeliveryDesc] = useState('');

  // Form states - Gate Pass
  const [gatePassOtp, setGatePassOtp] = useState('');
  const [verifiedPass, setVerifiedPass] = useState(null);

  useEffect(() => {
    const loadAllSecurityData = async () => {
      if (!user?.societyId) return;
      setLoading(true);
      try {
        const [
          flatsData,
          visitorsData,
          approvedData,
          helpData,
          attendanceData,
          deliveriesData,
          sosData
        ] = await Promise.all([
          getFlats(user.societyId),
          getSocietyVisitors(user.societyId),
          getSocietyApprovedVisitors(user.societyId),
          getSocietyDailyHelp(user.societyId),
          getSocietyHelpAttendance(user.societyId),
          getSocietyDeliveries(user.societyId),
          getActiveSOSAlerts(user.societyId)
        ]);

        setFlats(flatsData || []);
        setVisitorsLog(visitorsData || []);
        setApprovedList(approvedData || []);
        setDailyHelpList(helpData || []);
        setAttendanceLog(attendanceData || []);
        setDeliveriesList(deliveriesData || []);
        setActiveSOS(sosData || []);
      } catch (err) {
        console.error('Error loading security data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAllSecurityData();
  }, [user?.societyId]);

  // SOS Polling every 10 seconds to respond to emergencies instantly
  useEffect(() => {
    if (!user?.societyId) return;
    const interval = setInterval(async () => {
      try {
        const sosData = await getActiveSOSAlerts(user.societyId);
        setActiveSOS(sosData || []);
      } catch (err) {
        console.error('SOS polling error:', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.societyId]);

  const clearSuccessAndError = () => {
    setError('');
    setSuccessMsg('');
  };

  // 1. Submit Visitor Log
  const handleVisitorSubmit = async (e) => {
    e.preventDefault();
    if (!visitorFlat) {
      setError('Please select a flat.');
      return;
    }
    setSubmitting(true);
    clearSuccessAndError();

    try {
      let photoUrl = '';
      if (visitorPhotoFile) {
        const ext = visitorPhotoFile.name.split('.').pop();
        const path = `visitor_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('visitor-photos')
          .upload(path, visitorPhotoFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('visitor-photos').getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      await logVisitorEntry({
        societyId: user.societyId,
        flatId: visitorFlat,
        visitorName,
        phone: visitorPhone,
        purpose: visitorPurpose,
        vehicleNumber: visitorVehicle,
        photoUrl
      });

      setSuccessMsg(`Visitor entry logged for ${visitorName}`);
      setVisitorName('');
      setVisitorPhone('');
      setVisitorFlat('');
      setVisitorPurpose('Guest');
      setVisitorVehicle('');
      setVisitorPhotoFile(null);

      // Reload
      const updated = await getSocietyVisitors(user.societyId);
      setVisitorsLog(updated);
    } catch (err) {
      setError(err.message || 'Failed to log visitor entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Log Visitor Exit
  const handleVisitorExit = async (visitorId, name) => {
    try {
      await logVisitorExit(visitorId);
      setSuccessMsg(`Visitor exit marked for ${name}`);
      const updated = await getSocietyVisitors(user.societyId);
      setVisitorsLog(updated);
    } catch (err) {
      setError('Failed to mark visitor exit.');
    }
  };

  // Auto-fill Visitor form using Pre-approved guest details
  const handleSelectPreApproved = (guest) => {
    setVisitorName(guest.name);
    setVisitorPhone(guest.phone);
    setVisitorFlat(guest.flat_id);
    setVisitorPurpose('Guest');
    setSuccessMsg(`Pre-Approved details loaded for ${guest.name}. Check details and click Log Entry.`);
  };

  // 2. Submit Delivery Log
  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!deliveryFlat) {
      setError('Please select a flat.');
      return;
    }
    setSubmitting(true);
    clearSuccessAndError();

    try {
      await logDelivery({
        societyId: user.societyId,
        flatId: deliveryFlat,
        courierName,
        description: deliveryDesc
      });

      setSuccessMsg(`Delivery logged for Flat ${flats.find(f => f.id === deliveryFlat)?.flatNumber}`);
      setDeliveryFlat('');
      setDeliveryDesc('');
      
      const updated = await getSocietyDeliveries(user.societyId);
      setDeliveriesList(updated);
    } catch (err) {
      setError('Failed to log delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Verify Gate Pass OTP
  const handleVerifyGatePass = async (e) => {
    e.preventDefault();
    if (!gatePassOtp) return;
    setSubmitting(true);
    clearSuccessAndError();
    setVerifiedPass(null);

    try {
      const result = await verifyAndUseGatePass(gatePassOtp);
      setVerifiedPass(result);
      setSuccessMsg(`Gate Pass OTP verified! Entry allowed for ${result.visitor_name} to Flat ${result.flat?.wing}-${result.flat?.flat_number}.`);
      setGatePassOtp('');
    } catch (err) {
      setError(err.message || 'Verification failed. OTP is invalid, expired, or used.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Mark Daily Help Attendance (IN/OUT)
  const handleHelpAttendance = async (help, action) => {
    clearSuccessAndError();
    try {
      // Find if help already has an active entry today (IN but no OUT)
      let activeRecord = null;
      if (action === 'OUT') {
        const todayStr = new Date().toISOString().split('T')[0];
        const helpAttendance = attendanceLog.filter(a => a.help_id === help.id);
        activeRecord = helpAttendance.find(a => a.date === todayStr && !a.out_time);
      }

      await markHelpAttendance(help.id, action, activeRecord?.id);
      setSuccessMsg(`Attendance marked ${action} for ${help.name}`);
      
      const updated = await getSocietyHelpAttendance(user.societyId);
      setAttendanceLog(updated);
    } catch (err) {
      setError('Failed to mark help attendance.');
    }
  };

  // 5. Resolve SOS Alert
  const handleResolveSOS = async (alertId, flatNo) => {
    try {
      await resolveSOSAlert(alertId);
      setSuccessMsg(`SOS Alert resolved for Flat ${flatNo}`);
      const updated = await getActiveSOSAlerts(user.societyId);
      setActiveSOS(updated);
    } catch (err) {
      setError('Failed to resolve SOS Alert.');
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  // Pre-approved filtered search
  const filteredApproved = approvedList.filter(item => {
    if (!item.is_active) return false;
    const query = preApprovedSearch.toLowerCase();
    return item.name.toLowerCase().includes(query) || item.phone.includes(query);
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      {/* Security Banner Header */}
      <header className="sticky top-0 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-30 shadow-md">
        <div className="flex items-center gap-2">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-white">SECURI<span className="text-sky-400">X</span> GUARD</h1>
            <p className="text-[10px] text-slate-400 font-bold">{user?.name} — Gate Security</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 bg-slate-900 hover:bg-red-950/20 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <LogOut className="h-4 w-4" />
          <span>Exit Panel</span>
        </button>
      </header>

      {/* SOS Banners (Distress alarms always take high priority) */}
      {activeSOS.length > 0 && (
        <div className="bg-red-950/90 border-b-2 border-red-500 p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-2.5 text-red-400">
            <AlertOctagon className="h-6 w-6 shrink-0 text-red-500" />
            <div>
              <span className="font-extrabold uppercase text-xs tracking-wider">CRITICAL EMERGENCY DISTRESS SIGNALS</span>
              <span className="block text-[10px] text-red-300">Guards must respond and verify flats immediately!</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeSOS.map(sos => (
              <div key={sos.id} className="bg-slate-950 border border-red-500/40 rounded-xl p-3.5 flex justify-between items-center">
                <div>
                  <div className="text-sm font-black text-white">Flat {sos.flat?.wing} - {sos.flat?.flat_number}</div>
                  <div className="text-xs text-slate-400 font-semibold">{sos.flat?.owner?.name} ({sos.flat?.owner?.phone})</div>
                  <div className="text-[10px] text-red-400 font-medium mt-1">Triggered: {new Date(sos.triggered_at).toLocaleTimeString()}</div>
                </div>
                <button
                  onClick={() => handleResolveSOS(sos.id, `${sos.flat?.wing}-${sos.flat?.flat_number}`)}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold text-xs shadow-md transition-colors"
                >
                  RESOLVE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">

        {/* Global Feedback Banner */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500/40 text-red-400 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertOctagon className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Security Guards Navigation Tabs */}
        <div className="grid grid-cols-5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-center gap-1">
          {[
            { id: 'visitors', label: 'Visitors', icon: Users },
            { id: 'deliveries', label: 'Parcels', icon: Package },
            { id: 'gatepass', label: 'Verify', icon: Key },
            { id: 'dailyhelp', label: 'Staff', icon: UserCheck }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); clearSuccessAndError(); }}
                className={`flex flex-col items-center py-2.5 rounded-lg text-[9px] font-bold uppercase transition-all gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/30'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          {/* SOS status indicator tab */}
          <button
            onClick={() => { setActiveTab('sos'); clearSuccessAndError(); }}
            className={`flex flex-col items-center py-2.5 rounded-lg text-[9px] font-bold uppercase transition-all gap-1.5 relative ${
              activeTab === 'sos'
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="h-4.5 w-4.5" />
            <span>SOS</span>
            {activeSOS.length > 0 && (
              <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Tab 1: Visitors Logger & Pre-Approved Search */}
        {activeTab === 'visitors' && (
          <div className="space-y-6">
            
            {/* Search Pre-Approved Visitors (Fast Track) */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-white tracking-wider">Fast Search: Pre-Approved</h3>
                <span className="bg-sky-950 text-sky-400 text-[9px] px-2 py-0.5 rounded font-extrabold uppercase border border-sky-850">Pre-Approved</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Enter guest name or phone number..."
                  value={preApprovedSearch}
                  onChange={(e) => setPreApprovedSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              {/* Show matching results */}
              {preApprovedSearch && (
                <div className="space-y-2 max-h-36 overflow-y-auto pt-2">
                  {filteredApproved.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">No matching pre-approved visitors found.</div>
                  ) : (
                    filteredApproved.map(guest => (
                      <div
                        key={guest.id}
                        onClick={() => handleSelectPreApproved(guest)}
                        className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-850 rounded-xl cursor-pointer hover:border-sky-500/50 hover:bg-slate-900/80 active:scale-[0.99] transition-all"
                      >
                        <div>
                          <span className="block text-xs font-black text-white">{guest.name}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Phone: {guest.phone} | Flat {flats.find(f => f.id === guest.flat_id)?.flatNumber || '—'}</span>
                        </div>
                        <span className="px-2 py-1 bg-sky-950 text-sky-400 rounded-lg text-[9px] font-extrabold border border-sky-900">
                          {guest.relation}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Manual Entry Form */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Log New Visitor Entry</h3>
              <form onSubmit={handleVisitorSubmit} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Visitor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Guest Full Name"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Mobile Number"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Wing & Flat</label>
                    <select
                      required
                      value={visitorFlat}
                      onChange={(e) => setVisitorFlat(e.target.value)}
                      className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select Flat</option>
                      {flats.map(f => (
                        <option key={f.id} value={f.id}>{f.wing} - {f.flatNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Purpose</label>
                    <select
                      value={visitorPurpose}
                      onChange={(e) => setVisitorPurpose(e.target.value)}
                      className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="Guest">Guest</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Cab">Cab</option>
                      <option value="Service">Service</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Vehicle Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. MH-12-AB-1234"
                    value={visitorVehicle}
                    onChange={(e) => setVisitorVehicle(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Visitor Photo (Optional)</label>
                  <div className="flex items-center justify-center border border-dashed border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-900/30 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setVisitorPhotoFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="text-center space-y-1.5 text-slate-450">
                      <Upload className="h-5 w-5 mx-auto text-slate-500" />
                      <span className="block text-[10px] font-bold">
                        {visitorPhotoFile ? visitorPhotoFile.name : 'Tap to take picture / Upload'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-3 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Log Visitor Entry</span>
                  )}
                </button>
              </form>
            </div>

            {/* Active Inside Visitors list */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Currently Inside Society</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {visitorsLog.filter(v => v.status === 'inside').length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No visitors logged inside society.</div>
                ) : (
                  visitorsLog.filter(v => v.status === 'inside').map(visitor => (
                    <div key={visitor.id} className="flex justify-between items-center p-3 bg-slate-900/60 border border-slate-850 rounded-xl">
                      <div>
                        <span className="block text-xs font-black text-white">{visitor.visitor_name}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Flat {visitor.flat?.wing}-{visitor.flat?.flat_number} | Phone: {visitor.phone}</span>
                        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-750">
                          {visitor.purpose}
                        </span>
                      </div>
                      <button
                        onClick={() => handleVisitorExit(visitor.id, visitor.visitor_name)}
                        className="px-3 py-1.5 bg-slate-850 hover:bg-emerald-950/40 border border-slate-750 hover:border-emerald-500/40 text-[10px] font-bold text-slate-300 hover:text-emerald-400 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <ExitIcon className="h-3 w-3" />
                        <span>OUT</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Delivery/Parcel Logging */}
        {activeTab === 'deliveries' && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Log Courier / Package</h3>
              <form onSubmit={handleDeliverySubmit} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Courier Service</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['Amazon', 'Swiggy', 'Zomato', 'Dunzo', 'Other'].map(courier => (
                      <button
                        key={courier}
                        type="button"
                        onClick={() => setCourierName(courier)}
                        className={`py-2 px-1 rounded-lg border text-[9px] font-extrabold uppercase transition-all ${
                          courierName === courier
                            ? 'border-sky-500 bg-sky-950/20 text-sky-400 font-bold'
                            : 'border-slate-850 bg-slate-900 text-slate-500'
                        }`}
                      >
                        {courier}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Select Flat</label>
                  <select
                    required
                    value={deliveryFlat}
                    onChange={(e) => setDeliveryFlat(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Select Flat</option>
                    {flats.map(f => (
                      <option key={f.id} value={f.id}>{f.wing} - {f.flatNumber}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">OTP / Package Details (Optional)</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. OTP code, box size, instructions..."
                    value={deliveryDesc}
                    onChange={(e) => setDeliveryDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-3 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Log Delivery</span>
                  )}
                </button>
              </form>
            </div>

            {/* List of Pending Deliveries at Gate */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Pending Collection at Gate</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {deliveriesList.filter(d => d.status === 'pending').length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No deliveries pending collection.</div>
                ) : (
                  deliveriesList.filter(d => d.status === 'pending').map(del => (
                    <div key={del.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-[10px] text-sky-400 uppercase tracking-wider">{del.courier_name}</span>
                        <span className="block text-xs font-bold text-white mt-0.5">Flat {del.flat?.wing}-{del.flat?.flat_number}</span>
                        {del.description && <span className="block text-[10px] text-slate-400 mt-1">{del.description}</span>}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded bg-amber-950/20 text-amber-500 border border-amber-950 text-[8px] font-bold px-2 py-0.5 uppercase">
                        <Clock className="h-2 w-2" />
                        Gate
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Gate Pass Verify */}
        {activeTab === 'gatepass' && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Verify One-Time Gate Pass</h3>
              <form onSubmit={handleVerifyGatePass} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Enter OTP Code</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter 6-digit OTP Code"
                    value={gatePassOtp}
                    onChange={(e) => setGatePassOtp(e.target.value.trim())}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-center tracking-widest text-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-3 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Verify & Use Gate Pass</span>
                  )}
                </button>
              </form>
            </div>

            {/* Verification Result Card */}
            {verifiedPass && (
              <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-3.5">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <span className="font-extrabold text-xs uppercase tracking-wider">Verified Successfully</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-350">
                    <span>Visitor Name:</span>
                    <span className="font-bold text-white">{verifiedPass.visitor_name}</span>
                  </div>
                  <div className="flex justify-between text-slate-350">
                    <span>Flat to Visit:</span>
                    <span className="font-bold text-white">Flat {verifiedPass.flat?.wing} - {verifiedPass.flat?.flat_number}</span>
                  </div>
                  <div className="flex justify-between text-slate-350">
                    <span>Valid window:</span>
                    <span className="text-slate-400">{new Date(verifiedPass.valid_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(verifiedPass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-900/60 text-center text-[10px] text-emerald-400 font-semibold">
                    ENTRY AUTHORIZED • OTP MARKED AS EXPIRED
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Daily Help Attendance */}
        {activeTab === 'dailyhelp' && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Staff / Daily Help Check-In</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dailyHelpList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No staff/help registered in the system.</div>
                ) : (
                  dailyHelpList.map(help => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const helpAttendance = attendanceLog.filter(a => a.help_id === help.id);
                    const todayAttendance = helpAttendance.find(a => a.date === todayStr);
                    const isCheckedIn = todayAttendance && !todayAttendance.out_time;

                    return (
                      <div key={help.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="block text-xs font-black text-white">{help.name}</span>
                          <span className="block text-[10px] text-slate-450 mt-0.5">{help.role} | Phone: {help.phone}</span>
                          <span className="block text-[9px] text-slate-400 mt-1">Flat {help.flat?.wing}-{help.flat?.flat_number}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleHelpAttendance(help, 'IN')}
                            disabled={isCheckedIn || (todayAttendance && todayAttendance.out_time)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                              isCheckedIn || (todayAttendance && todayAttendance.out_time)
                                ? 'bg-slate-850 text-slate-600 border-slate-800'
                                : 'bg-emerald-950 text-emerald-400 border-emerald-900 hover:bg-emerald-900/60'
                            }`}
                          >
                            IN
                          </button>
                          <button
                            onClick={() => handleHelpAttendance(help, 'OUT')}
                            disabled={!isCheckedIn}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                              !isCheckedIn
                                ? 'bg-slate-850 text-slate-600 border-slate-800'
                                : 'bg-rose-950 text-rose-450 border-rose-900 hover:bg-rose-900/60'
                            }`}
                          >
                            OUT
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: SOS Alert Log */}
        {activeTab === 'sos' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-black uppercase text-white tracking-wider">Distress Alarm Logs</h3>
            <div className="space-y-3">
              {activeSOS.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No active distress signals. All flat units report secure.</div>
              ) : (
                activeSOS.map(sos => (
                  <div key={sos.id} className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-sm font-black text-white">Flat {sos.flat?.wing} - {sos.flat?.flat_number}</div>
                      <div className="text-xs text-slate-400">{sos.flat?.owner?.name} | {sos.flat?.owner?.phone}</div>
                      <span className="inline-block text-[9px] text-red-400 bg-red-950 border border-red-900 px-1.5 py-0.5 rounded font-extrabold uppercase mt-1.5 animate-pulse">ACTIVE SOS</span>
                    </div>
                    <button
                      onClick={() => handleResolveSOS(sos.id, `${sos.flat?.wing}-${sos.flat?.flat_number}`)}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold text-xs shadow-md transition-colors"
                    >
                      RESOLVE
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SecurityDashboard;
