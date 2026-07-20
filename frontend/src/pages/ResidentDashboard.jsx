import React, { useState, useEffect } from 'react';
import {
  getMyFlats,
  getBills,
  getPaymentHistory,
  getNotices,
  getComplaints,
  createPaymentOrder,
  downloadReceipt,
  getVisitors,
  getApprovedVisitors,
  addApprovedVisitor,
  toggleApprovedVisitor,
  getDailyHelp,
  getHelpAttendance,
  addDailyHelp,
  getDeliveries,
  markDeliveryCollected,
  createGatePass,
  getGatePasses,
  triggerSOS
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  ArrowRight,
  Download,
  CheckCircle2,
  Megaphone,
  Wrench,
  AlertTriangle,
  Flame,
  User,
  Users,
  ShieldAlert,
  Plus,
  ToggleLeft,
  ToggleRight,
  Clock,
  Package,
  Check,
  QrCode,
  Ticket,
  ChevronRight,
  Loader2
} from 'lucide-react';

const ResidentDashboard = () => {
  const { user } = useAuth();
  const [flat, setFlat] = useState(null);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // New features state
  const [visitors, setVisitors] = useState([]);
  const [approvedVisitors, setApprovedVisitors] = useState([]);
  const [dailyHelp, setDailyHelp] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [gatePasses, setGatePasses] = useState([]);
  
  // Selected daily help for attendance details
  const [selectedHelp, setSelectedHelp] = useState(null);
  const [helpAttendance, setHelpAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Modals / forms states
  const [showGatePassModal, setShowGatePassModal] = useState(false);
  const [gatePassName, setGatePassName] = useState('');
  const [gatePassValidHours, setGatePassValidHours] = useState('24');
  const [newGatePassCode, setNewGatePassCode] = useState('');

  const [showPreApprovedModal, setShowPreApprovedModal] = useState(false);
  const [preName, setPreName] = useState('');
  const [prePhone, setPrePhone] = useState('');
  const [preRelation, setPreRelation] = useState('friend'); // family, friend, maid, driver
  const [preValidUntil, setPreValidUntil] = useState('');

  const [showDailyHelpModal, setShowDailyHelpModal] = useState(false);
  const [helpName, setHelpName] = useState('');
  const [helpPhone, setHelpPhone] = useState('');
  const [helpRole, setHelpRole] = useState('Maid');
  const [helpDays, setHelpDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

  // Advance billing states
  const [selectedAdvanceMonths, setSelectedAdvanceMonths] = useState([]);

  // SOS status
  const [sosActive, setSosActive] = useState(false);

  // Active sub-section tab inside Access log panel
  const [accessTab, setAccessTab] = useState('history'); // history, preapproved, gatepass

  const fetchResidentDashboardData = async () => {
    try {
      const [
        flatData,
        pendingBills,
        overdueBills,
        paymentsData,
        noticesData,
        complaintsData
      ] = await Promise.all([
        getMyFlats(),
        getBills({ status: 'pending' }),
        getBills({ status: 'overdue' }),
        getPaymentHistory(),
        getNotices(user?.societyId),
        getComplaints(),
      ]);

      let activeFlat = null;
      if (flatData.length > 0) {
        activeFlat = flatData[0];
        setFlat(activeFlat);
      }

      setBills([...overdueBills, ...pendingBills]);
      setPayments(paymentsData);
      setNotices(noticesData || []);
      setComplaints(complaintsData.slice(0, 4));

      if (activeFlat) {
        // Fetch gatekeeper features
        const [
          visitorsData,
          approvedData,
          helpData,
          deliveriesData,
          passesData
        ] = await Promise.all([
          getVisitors(activeFlat.id),
          getApprovedVisitors(activeFlat.id),
          getDailyHelp(activeFlat.id),
          getDeliveries(activeFlat.id),
          getGatePasses(activeFlat.id)
        ]);

        setVisitors(visitorsData || []);
        setApprovedVisitors(approvedData || []);
        setDailyHelp(helpData || []);
        setDeliveries(deliveriesData || []);
        setGatePasses(passesData || []);
      }
    } catch (err) {
      console.error('Error fetching resident dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchResidentDashboardData();
  }, [user]);

  // Load help attendance when clicked
  const handleViewHelpAttendance = async (help) => {
    setSelectedHelp(help);
    setLoadingAttendance(true);
    try {
      const data = await getHelpAttendance(help.id);
      setHelpAttendance(data || []);
    } catch (err) {
      console.error('Error loading help attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Payment redirects
  const handlePayNow = (billId) => {
    window.location.href = `/payment/checkout?bill_ids=${billId}`;
  };

  // Handle Advance Payment
  const handlePayAdvance = async () => {
    if (selectedAdvanceMonths.length === 0) return;
    try {
      // Create payment order for advance months.
      // Call createAdvancePaymentOrder in backend which creates bills on-the-fly.
      // First let's format the selectedMonths properly.
      // The body expects e.g. ['2026-08', '2026-09'].
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          },
          body: JSON.stringify({ advanceMonths: selectedAdvanceMonths, paymentMode: 'card' }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to order advance payment');
      
      // Redirect to checkout with newly created bill IDs!
      window.location.href = `/payment/checkout?bill_ids=${result.billIds?.join(',') || ''}`;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to initiate advance payment.');
    }
  };

  const handleToggleAdvanceMonth = (monthStr) => {
    if (selectedAdvanceMonths.includes(monthStr)) {
      setSelectedAdvanceMonths(selectedAdvanceMonths.filter(m => m !== monthStr));
    } else {
      setSelectedAdvanceMonths([...selectedAdvanceMonths, monthStr]);
    }
  };

  // Trigger SOS alert
  const handleTriggerSOS = async () => {
    if (!flat) return;
    const confirmSOS = window.confirm("WARNING: Are you sure you want to trigger a CRITICAL EMERGENCY SOS alarm? This will immediately alert all guards at the security gate and society admins.");
    if (!confirmSOS) return;

    try {
      setSosActive(true);
      await triggerSOS(flat.id);
      alert("SOS DISTRESS SIGNAL BROADCASTED! Guards and Admins have been notified with your flat number. Help is on the way.");
    } catch (err) {
      console.error('SOS failed:', err);
      alert("Failed to broadcast SOS. Please call security directly.");
      setSosActive(false);
    }
  };

  // Generate Digital Gate Pass
  const handleGenerateGatePass = async (e) => {
    e.preventDefault();
    if (!flat || !gatePassName) return;

    // Generate random 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const validUntil = new Date(now.getTime() + parseInt(gatePassValidHours) * 60 * 60 * 1000);

    try {
      await createGatePass({
        flatId: flat.id,
        visitorName: gatePassName,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
        otpCode: otp
      });

      setNewGatePassCode(otp);
      setGatePassName('');
      
      // Reload
      const passesData = await getGatePasses(flat.id);
      setGatePasses(passesData || []);
    } catch (err) {
      alert('Failed to generate gate pass.');
    }
  };

  // Pre-approved submit
  const handlePreApprovedSubmit = async (e) => {
    e.preventDefault();
    if (!flat || !preName || !prePhone) return;

    try {
      await addApprovedVisitor({
        flatId: flat.id,
        name: preName,
        phone: prePhone,
        relation: preRelation,
        validUntil: preValidUntil || null
      });

      setPreName('');
      setPrePhone('');
      setPreValidUntil('');
      setShowPreApprovedModal(false);

      // Reload
      const approvedData = await getApprovedVisitors(flat.id);
      setApprovedVisitors(approvedData || []);
      alert('Pre-approved visitor added successfully.');
    } catch (err) {
      alert('Failed to add approved visitor.');
    }
  };

  const handleToggleApproved = async (item) => {
    try {
      await toggleApprovedVisitor(item.id, !item.is_active);
      const approvedData = await getApprovedVisitors(flat.id);
      setApprovedVisitors(approvedData || []);
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  // Daily Help submit
  const handleDailyHelpSubmit = async (e) => {
    e.preventDefault();
    if (!flat || !helpName || !helpPhone) return;

    try {
      await addDailyHelp({
        flatId: flat.id,
        name: helpName,
        phone: helpPhone,
        role: helpRole,
        workingDays: helpDays
      });

      setHelpName('');
      setHelpPhone('');
      setShowDailyHelpModal(false);

      // Reload
      const helpData = await getDailyHelp(flat.id);
      setDailyHelp(helpData || []);
      alert('Staff registered successfully.');
    } catch (err) {
      alert('Failed to register daily help.');
    }
  };

  // Collect delivery
  const handleCollectDelivery = async (deliveryId) => {
    try {
      await markDeliveryCollected(deliveryId);
      const deliveriesData = await getDeliveries(flat.id);
      setDeliveries(deliveriesData || []);
      alert('Delivery marked as collected.');
    } catch (err) {
      alert('Failed to mark delivery collected.');
    }
  };

  const handleDownloadReceipt = async (payment) => {
    try {
      const blob = await downloadReceipt(payment);
      const fileURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Receipt_${payment.transactionId.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Receipt download failed:', err);
      alert('Failed to download receipt PDF.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Get current date context for advance payment options
  const today = new Date();
  const currentMonthYear = today.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit' }).split('/').reverse().join('-'); // YYYY-MM
  
  // Calculate next 3 months programmatically for advance billing options
  const advanceMonthsOptions = [];
  for (let i = 1; i <= 6; i++) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = nextMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const value = nextMonth.toISOString().substring(0, 7); // YYYY-MM
    advanceMonthsOptions.push({ label, value });
  }

  // Calculate dues
  const outstandingDues = bills.reduce((acc, curr) => acc + curr.amount + curr.penalty, 0);
  const currentBill = bills[0];

  // Notices
  const urgentNotices = notices.filter(n => n.is_urgent);
  const generalNotices = notices.filter(n => !n.is_urgent).slice(0, 3);

  return (
    <div className="space-y-6">
      
      {/* 1. URGENT BROADCAST NOTICE BANNER */}
      {urgentNotices.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <Megaphone className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600">CRITICAL ANNOUNCEMENT</span>
            {urgentNotices.map((notice) => (
              <div key={notice.id} className="mt-1">
                <h4 className="text-sm font-bold text-red-800">{notice.title}</h4>
                <p className="text-xs text-red-750 mt-0.5 leading-relaxed">{notice.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Ownership banner with Floating SOS Distress Switch */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">Unit Ownership</span>
          <h1 className="text-2xl font-bold font-sans text-slate-800 tracking-tight mt-0.5">
            Flat {flat ? `${flat.wing} - ${flat.flat_number}` : 'Unassigned'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{flat?.Society?.name || 'No society linked'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="grid grid-cols-2 gap-4 bg-white/60 backdrop-blur border border-sky-100/50 rounded-xl p-4 md:w-auto">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Unit Area</span>
              <span className="block text-xs font-bold text-slate-700 mt-0.5">{flat?.area_sqft || '—'} Sq. Ft.</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Base Rate</span>
              <span className="block text-xs font-bold text-slate-700 mt-0.5">₹ {flat?.maintenance_amount || '—'} / Mo</span>
            </div>
          </div>

          {/* SOS BUTTON */}
          <button
            onClick={handleTriggerSOS}
            className={`flex items-center gap-2 px-5 py-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
              sosActive
                ? 'bg-red-500 animate-ping'
                : 'bg-red-600 hover:bg-red-500 hover:shadow-red-200 active:scale-[0.98]'
            }`}
          >
            <Flame className="h-5 w-5" />
            <span>SOS EMERGENCY</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* 2. JIO-STYLE MAINTENANCE DUE CARD (Step 1) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-premium space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-850">Maintenance Status</h3>
              <p className="text-slate-450 text-xs mt-0.5">Track and recharge maintenance bills instantly</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              outstandingDues > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {outstandingDues > 0 ? `₹ ${outstandingDues} Pending` : 'All Settled'}
            </span>
          </div>

          {/* Dues recharging panel */}
          {outstandingDues > 0 && currentBill ? (
            <div className="bg-red-50/40 border border-red-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-red-500 font-extrabold uppercase tracking-wide">Maintenance Due</span>
                <h4 className="text-lg font-black text-slate-800">Bill for {currentBill.billingMonth}</h4>
                <div className="text-xs text-slate-500">Due Date: {new Date(currentBill.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                {currentBill.penalty > 0 && (
                  <div className="text-[10px] font-bold text-red-500 mt-1">Includes late fee: ₹ {currentBill.penalty}</div>
                )}
              </div>
              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <span className="text-2xl font-black text-slate-800">₹ {currentBill.amount + currentBill.penalty}</span>
                <button
                  onClick={() => handlePayNow(currentBill.id)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 shadow-lg hover:shadow-emerald-100 transition-all flex items-center gap-1.5"
                >
                  <span>Pay Now</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
              <span className="font-bold text-slate-800 text-sm">All society maintenance bills paid!</span>
              <span className="text-xs text-slate-400 mt-0.5">Thank you for helping keep operations running smoothly.</span>
            </div>
          )}

          {/* ADVANCE PAYMENT BOX */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Pay Advance Maintenance</h4>
              <p className="text-[11px] text-slate-400">Select months below to make a single combined advance payment</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {advanceMonthsOptions.map(option => {
                const isSelected = selectedAdvanceMonths.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => handleToggleAdvanceMonth(option.value)}
                    className={`p-3 border rounded-xl cursor-pointer select-none transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/20 text-sky-700 font-bold'
                        : 'border-slate-100 bg-slate-55/30 text-slate-500 hover:bg-slate-50/50'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{option.label.split(' ')[0]}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-350 text-sky-600 h-3.5 w-3.5"
                    />
                  </div>
                );
              })}
            </div>

            {selectedAdvanceMonths.length > 0 && (
              <div className="flex justify-between items-center bg-sky-50/30 border border-sky-100/50 rounded-2xl p-4">
                <div>
                  <span className="text-[10px] text-sky-600 font-bold uppercase">Advance Summary</span>
                  <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{selectedAdvanceMonths.length} Months selected</span>
                </div>
                <button
                  onClick={handlePayAdvance}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-3 shadow transition-all"
                >
                  Pay Advance (₹ {Number((flat?.maintenance_amount || 0) * selectedAdvanceMonths.length).toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* Quick links to full payment module */}
          <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2">
            <a
              href="/maintenance"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Manage Payments
            </a>
            <a
              href="/receipts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> View Receipts
            </a>
            <a
              href="/payment-history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" /> Full History
            </a>
          </div>
        </div>

        {/* Notice Board Summary */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-premium flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-850">Notice Board</h3>
                <p className="text-slate-455 text-xs">Recent society memos</p>
              </div>
              <Megaphone className="h-5 w-5 text-sky-500 shrink-0" />
            </div>

            {generalNotices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No active general memos at this time.</div>
            ) : (
              <div className="space-y-4">
                {generalNotices.map((notice) => (
                  <div key={notice.id} className="space-y-1 border-l-2 border-slate-200 pl-3">
                    <span className="block text-[9px] font-bold text-slate-400">{new Date(notice.createdAt).toLocaleDateString('en-IN')}</span>
                    <span className="block text-xs font-bold text-slate-800 truncate leading-tight">{notice.title}</span>
                    <span className="block text-xs text-slate-500 line-clamp-2 leading-relaxed">{notice.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <a href="/notices" className="block text-center text-xs font-semibold text-sky-600 hover:underline mt-4 pt-3 border-t border-slate-100">
            View All Memos
          </a>
        </div>
      </div>

      {/* QUICK ACTIONS BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => { setShowGatePassModal(true); setNewGatePassCode(''); }}
          className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-sky-500/30 transition-all flex flex-col items-center justify-center text-center gap-2"
        >
          <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Ticket className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 text-xs">Generate Gate Pass</span>
        </button>

        <button
          onClick={() => setShowPreApprovedModal(true)}
          className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-sky-500/30 transition-all flex flex-col items-center justify-center text-center gap-2"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 text-xs">Pre-approve Guest</span>
        </button>

        <button
          onClick={() => setShowDailyHelpModal(true)}
          className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-sky-500/30 transition-all flex flex-col items-center justify-center text-center gap-2"
        >
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 text-xs">Add Daily Help</span>
        </button>

        <a
          href="/complaints"
          className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-sky-500/30 transition-all flex flex-col items-center justify-center text-center gap-2"
        >
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 text-xs">File Helpdesk Ticket</span>
        </a>
      </div>

      {/* 3. ACCESS CONTROL, STAFF & DELIVERIES */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Access and Gate Pass Logs */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-850">Visitor & Gate Security</h3>
              <p className="text-slate-450 text-xs mt-0.5">Control who enters your unit</p>
            </div>
            
            <div className="flex bg-slate-50 p-1 rounded-lg text-xs font-bold gap-1 self-start sm:self-auto">
              {[
                { id: 'history', label: 'Visitor Logs' },
                { id: 'preapproved', label: 'Pre-Approved' },
                { id: 'gatepass', label: 'Gate Passes' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAccessTab(tab.id)}
                  className={`px-3 py-1.5 rounded transition-all ${
                    accessTab === tab.id
                      ? 'bg-white shadow-sm text-sky-600'
                      : 'text-slate-400 hover:text-slate-655'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tab 1: Visitor Logs */}
          {accessTab === 'history' && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {visitors.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No visitor logs recorded.</div>
              ) : (
                visitors.map(visitor => (
                  <div key={visitor.id} className="p-3 border border-slate-50 bg-slate-50/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{visitor.visitor_name}</div>
                      <div className="text-slate-450 text-[10px] mt-0.5">Phone: {visitor.phone} | Vehicle: {visitor.vehicle_number || 'None'}</div>
                      <div className="text-[10px] font-medium text-slate-400 mt-1">
                        IN: {new Date(visitor.entry_time).toLocaleString()} 
                        {visitor.exit_time && ` | OUT: ${new Date(visitor.exit_time).toLocaleString()}`}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      visitor.status === 'inside'
                        ? 'bg-sky-50 text-sky-700 border border-sky-100'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {visitor.status === 'inside' ? 'Inside' : 'Exited'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab 2: Pre-approved list */}
          {accessTab === 'preapproved' && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {approvedVisitors.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No pre-approved visitors added.</div>
              ) : (
                approvedVisitors.map(guest => (
                  <div key={guest.id} className="p-3 border border-slate-50 bg-slate-50/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{guest.name}</div>
                      <div className="text-slate-450 text-[10px] mt-0.5">Phone: {guest.phone} | Relation: {guest.relation}</div>
                      {guest.valid_until && (
                        <div className="text-[10px] text-slate-400 mt-1">Valid Until: {new Date(guest.valid_until).toLocaleDateString()}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleApproved(guest)}
                      className="rounded text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {guest.is_active ? (
                        <ToggleRight className="h-8 w-8 text-sky-550" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-slate-300" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab 3: Gate Passes */}
          {accessTab === 'gatepass' && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {gatePasses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No gate passes generated.</div>
              ) : (
                gatePasses.map(pass => (
                  <div key={pass.id} className="p-3 border border-slate-50 bg-slate-50/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{pass.visitor_name}</div>
                      <div className="text-slate-450 text-[10px] mt-0.5">Code: <span className="font-mono font-bold text-sky-600">{pass.otp_code}</span></div>
                      <div className="text-[10px] text-slate-400 mt-1">Expires: {new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(pass.valid_until).toLocaleDateString()})</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      pass.is_used
                        ? 'bg-slate-100 text-slate-400'
                        : new Date() > new Date(pass.valid_until)
                        ? 'bg-red-50 text-red-500'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {pass.is_used ? 'Used' : new Date() > new Date(pass.valid_until) ? 'Expired' : 'Active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Deliveries collection box */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-850">Deliveries at Gate</h3>
            <p className="text-slate-450 text-xs mt-0.5">Uncollected packages at security desk</p>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {deliveries.filter(d => d.status === 'pending').length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Package className="h-8 w-8 text-slate-300" />
                <span>All deliveries collected!</span>
              </div>
            ) : (
              deliveries.filter(d => d.status === 'pending').map(delivery => (
                <div key={delivery.id} className="p-3 border border-slate-50 bg-slate-50/30 rounded-xl flex items-start justify-between gap-3 text-xs">
                  <div>
                    <span className="font-extrabold text-[10px] text-sky-600 uppercase tracking-wider">{delivery.courier_name}</span>
                    <div className="text-slate-400 text-[10px] mt-0.5">Logged: {new Date(delivery.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {delivery.description && <div className="text-[10px] text-slate-500 mt-1 italic">{delivery.description}</div>}
                  </div>
                  <button
                    onClick={() => handleCollectDelivery(delivery.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-55/80 text-emerald-700 font-bold hover:bg-emerald-50 border border-emerald-100 text-[10px] shadow-sm flex items-center gap-1 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Collect
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. DAILY HELP STAFF & ATTENDANCE LOG */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-850">Daily Staff & Attendance</h3>
            <p className="text-slate-450 text-xs mt-0.5">Check in-out logs of your maids, drivers & cooks</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Registered helps */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 border-r border-slate-100/50">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Registered Staff</h4>
              {dailyHelp.length === 0 ? (
                <div className="text-slate-400 text-xs py-6">No help registered.</div>
              ) : (
                dailyHelp.map(help => (
                  <div
                    key={help.id}
                    onClick={() => handleViewHelpAttendance(help)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                      selectedHelp?.id === help.id
                        ? 'border-sky-500 bg-sky-50/10'
                        : 'border-slate-50 bg-slate-50/20 hover:border-slate-150'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-800">{help.name}</div>
                      <div className="text-[10px] text-slate-450 mt-0.5">{help.role} | Days: {help.working_days?.slice(0, 3).join(', ')}...</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                ))
              )}
            </div>

            {/* Attendance logs */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                {selectedHelp ? `${selectedHelp.name} Logs` : 'Attendance Ledger'}
              </h4>
              
              {selectedHelp ? (
                loadingAttendance ? (
                  <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : helpAttendance.length === 0 ? (
                  <div className="text-slate-400 text-xs py-8 text-center bg-slate-50/30 rounded-xl">No logs recorded for {selectedHelp.name}.</div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {helpAttendance.map(log => (
                      <div key={log.id} className="p-2.5 bg-slate-50/40 border border-slate-100 rounded-lg flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">{new Date(log.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                        <div className="text-[10px] text-slate-450 font-mono">
                          IN: {new Date(log.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                          {log.out_time ? ` | OUT: ${new Date(log.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' | Inside'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/20 border border-slate-100 rounded-xl">
                  Select a staff member from the left to view attendance history logs.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Existing helpdesk widget */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-premium flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-850">Helpdesk Tickets</h3>
                <p className="text-slate-455 text-xs">Status of filed maintenance requests</p>
              </div>
              <Wrench className="h-5 w-5 text-slate-400" />
            </div>

            {complaints.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No tickets submitted yet.</div>
            ) : (
              <div className="space-y-3">
                {complaints.map((comp) => (
                  <div key={comp.id} className="flex items-start justify-between p-2.5 border border-slate-100 rounded-lg bg-slate-50/20">
                    <div>
                      <span className="block text-xs font-semibold text-slate-800 leading-tight">{comp.title}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 capitalize">{comp.category}</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      comp.status === 'pending' ? 'bg-red-50 text-red-700 border border-red-100' :
                      comp.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {comp.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <a href="/complaints" className="block text-center text-xs font-semibold text-sky-600 hover:underline mt-4 pt-3 border-t border-slate-100">
            Submit New Ticket
          </a>
        </div>
      </div>

      {/* Payments History table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-850">Payment History</h3>
          <p className="text-slate-455 text-xs">Ledger of all settled maintenance fees</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                <th className="pb-3">Month</th>
                <th className="pb-3">Reference ID</th>
                <th className="pb-3">Paid Date</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400">No payment records found.</td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-semibold text-slate-800">{pay.Bill ? pay.Bill.billingMonth : 'Advance'}</td>
                    <td className="py-3 font-mono text-xs">{pay.transactionId.substring(0, 15)}...</td>
                    <td className="py-3 text-xs text-slate-400">{new Date(pay.paymentDate).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 font-bold text-slate-800">₹ {pay.amount}</td>
                    <td className="py-3 text-right">
                      {pay.receiptUrl && (
                        <button
                          onClick={() => handleDownloadReceipt(pay)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Generate Gate Pass */}
      {showGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Generate Digital Gate Pass</h3>
            
            {newGatePassCode ? (
              <div className="text-center p-6 bg-sky-50 border border-sky-100 rounded-xl space-y-4">
                <div className="h-12 w-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
                  <QrCode className="h-6 w-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Verification OTP</span>
                  <span className="block text-3xl font-black font-mono tracking-widest text-sky-600">{newGatePassCode}</span>
                </div>
                <p className="text-xs text-slate-500">Share this code with your guest. Security will scan/enter it at the gate to allow entry.</p>
                <button
                  type="button"
                  onClick={() => setShowGatePassModal(false)}
                  className="w-full rounded-xl bg-slate-900 text-white font-bold text-xs py-2.5"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerateGatePass} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Guest Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Guest Full Name"
                    value={gatePassName}
                    onChange={(e) => setGatePassName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Validity Duration</label>
                  <select
                    value={gatePassValidHours}
                    onChange={(e) => setGatePassValidHours(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="4">4 Hours</option>
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours</option>
                    <option value="48">48 Hours</option>
                  </select>
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGatePassModal(false)}
                    className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-600 text-white font-bold text-xs py-2 px-4 shadow"
                  >
                    Create Pass
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Pre-approve Visitor */}
      {showPreApprovedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-850">Pre-approve Guest / Frequent Visitor</h3>
            <form onSubmit={handlePreApprovedSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Guest Name</label>
                <input
                  type="text"
                  required
                  placeholder="Visitor Name"
                  value={preName}
                  onChange={(e) => setPreName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="Mobile Number"
                  value={prePhone}
                  onChange={(e) => setPrePhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Relation</label>
                  <select
                    value={preRelation}
                    onChange={(e) => setPreRelation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="family">Family</option>
                    <option value="friend">Friend</option>
                    <option value="maid">Maid</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Validity Until (Optional)</label>
                  <input
                    type="date"
                    value={preValidUntil}
                    onChange={(e) => setPreValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPreApprovedModal(false)}
                  className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 text-white font-bold text-xs py-2 px-4 shadow"
                >
                  Add Approved Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Daily Help */}
      {showDailyHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-850">Register Daily Help / Staff</h3>
            <form onSubmit={handleDailyHelpSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Staff Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={helpName}
                  onChange={(e) => setHelpName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="Mobile Number"
                  value={helpPhone}
                  onChange={(e) => setHelpPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Role</label>
                <select
                  value={helpRole}
                  onChange={(e) => setHelpRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="Maid">Maid</option>
                  <option value="Driver">Driver</option>
                  <option value="Cook">Cook</option>
                  <option value="Watchman">Watchman</option>
                  <option value="Nanny">Nanny / Caretaker</option>
                  <option value="Gardener">Gardener</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDailyHelpModal(false)}
                  className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 text-white font-bold text-xs py-2 px-4 shadow"
                >
                  Register Help
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResidentDashboard;
