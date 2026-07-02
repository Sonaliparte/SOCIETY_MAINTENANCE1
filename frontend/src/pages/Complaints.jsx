import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyFlats, getComplaints, createComplaint, updateComplaintStatus } from '../services/dataService';
import { Wrench, Plus, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const Complaints = () => {
  const { isAdmin } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [myFlats, setMyFlats] = useState([]);
  const [flatId, setFlatId] = useState('');
  const [category, setCategory] = useState('plumbing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!isAdmin) {
        try {
          const data = await getMyFlats();
          setMyFlats(data);
          if (data.length > 0) setFlatId(data[0].id);
        } catch (err) {
          console.error('Error loading flats:', err);
        }
      }
    };
    fetchInitialData();
  }, [isAdmin]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const data = await getComplaints(statusFilter || undefined);
      setComplaints(data);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  const handleLodgeComplaint = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createComplaint({ flatId, category, title, description });
      alert('Complaint ticket successfully logged!');
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      fetchComplaints();
    } catch (err) {
      alert(err.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateComplaintStatus(id, newStatus);
      fetchComplaints();
    } catch (err) {
      alert(err.message || 'Failed to update complaint status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Helpdesk Tickets</h1>
          <p className="text-slate-500 text-sm">
            {isAdmin ? 'Track and resolve maintenance tickets.' : 'File service requests for your flat.'}
          </p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2.5 shadow flex items-center gap-1.5 self-start sm:self-auto">
            <Plus className="h-4.5 w-4.5" />
            Lodge Service Ticket
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">All Tickets</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <button onClick={fetchComplaints} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-3 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {complaints.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-12 text-center text-slate-400">
              <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <span className="font-semibold block text-slate-800 text-sm">No service tickets found</span>
            </div>
          ) : (
            complaints.map((comp) => (
              <div key={comp.id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-premium flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase ${
                      comp.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      comp.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {comp.status === 'resolved' && <CheckCircle className="h-3 w-3" />}
                      {comp.status === 'in_progress' && <Clock className="h-3 w-3" />}
                      {comp.status === 'pending' && <AlertCircle className="h-3 w-3" />}
                      {comp.status === 'in_progress' ? 'In Progress' : comp.status}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">Category: {comp.category}</span>
                    {isAdmin && comp.Flat && (
                      <span className="text-xs font-bold text-sky-600">
                        Flat {comp.Flat.wing} - {comp.Flat.flatNumber} ({comp.Flat.owner?.name})
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">{comp.title}</h3>
                  <p className="text-xs text-slate-500">{comp.description}</p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUpdateStatus(comp.id, 'in_progress')} disabled={updatingId === comp.id || comp.status === 'in_progress'} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-1 disabled:opacity-50">In Progress</button>
                    <button onClick={() => handleUpdateStatus(comp.id, 'resolved')} disabled={updatingId === comp.id || comp.status === 'resolved'} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-1 disabled:opacity-50">Resolve</button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">{new Date(comp.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Lodge Helpdesk Ticket</h3>
            {myFlats.length === 0 ? (
              <p className="text-sm text-red-600">No flat assigned to your account. Contact the society secretary.</p>
            ) : (
              <form onSubmit={handleLodgeComplaint} className="space-y-4">
                {myFlats.length > 1 && (
                  <select value={flatId} onChange={(e) => setFlatId(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm">
                    {myFlats.map((f) => <option key={f.id} value={f.id}>Flat {f.wing} - {f.flatNumber}</option>)}
                  </select>
                )}
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm">
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="security">Security</option>
                  <option value="other">Other</option>
                </select>
                <input type="text" required placeholder="Ticket Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
                <textarea required rows="4" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm resize-none" />
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Lodging...' : 'Submit'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Complaints;
