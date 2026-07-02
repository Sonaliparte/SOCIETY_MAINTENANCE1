import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocieties, getNotices, createNotice } from '../services/dataService';
import { Megaphone, Plus, Bell, RefreshCw, User, Calendar } from 'lucide-react';

const NoticeBoard = () => {
  const { isAdmin, user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        const data = await getSocieties();
        setSocieties(data);
        setSelectedSocietyId(data[0]?.id || user?.societyId || '');
      } catch (err) {
        console.error('Error loading societies:', err);
        if (user?.societyId) setSelectedSocietyId(user.societyId);
      }
    };
    fetchSocieties();
  }, [user?.societyId]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const data = await getNotices(selectedSocietyId || user?.societyId);
      setNotices(data);
    } catch (err) {
      console.error('Error loading notices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSocietyId || user?.societyId) fetchNotices();
  }, [selectedSocietyId, user?.societyId]);

  const handlePostNotice = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createNotice({ societyId: selectedSocietyId, title, content });
      alert('Notice successfully posted!');
      setShowAddModal(false);
      setTitle('');
      setContent('');
      fetchNotices();
    } catch (err) {
      alert(err.message || 'Failed to publish notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Notice Board</h1>
          <p className="text-slate-500 text-sm">Review announcements broadcasted by the committee.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2.5 shadow flex items-center gap-1.5 self-start sm:self-auto">
            <Plus className="h-4.5 w-4.5" />
            Publish Notice
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        {isAdmin && societies.length > 0 && (
          <select value={selectedSocietyId} onChange={(e) => setSelectedSocietyId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {societies.map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
          </select>
        )}
        <button onClick={fetchNotices} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-3 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {notices.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-12 text-center text-slate-400">
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <span className="font-semibold block text-slate-800 text-sm">No active announcements</span>
            </div>
          ) : (
            notices.map((notice) => (
              <div key={notice.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-premium relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-sky-500" />
                <div className="space-y-3 pl-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <h3 className="text-base font-bold text-slate-800">{notice.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(notice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{notice.poster?.name || 'Committee Office'}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{notice.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Publish Notice Bulletin</h3>
            <form onSubmit={handlePostNotice} className="space-y-4">
              <input type="text" required placeholder="Bulletin Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              <textarea required rows="5" placeholder="Notice content..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm resize-none" />
              <div className="p-3 border border-sky-100 bg-sky-50/50 rounded-xl flex items-start gap-2.5">
                <Bell className="h-5 w-5 shrink-0 text-sky-500" />
                <p className="text-[11px] text-sky-700">Publishing pins this notice to resident dashboards.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Publishing...' : 'Broadcast'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
