import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSocieties,
  getFlats,
  createFlat,
  assignOwnerByEmail,
  lookupProfileByEmail,
} from '../services/dataService';
import { Plus, UserPlus, Search } from 'lucide-react';

const FlatsManagement = () => {
  const { user } = useAuth();
  const [flats, setFlats] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFlatModal, setShowFlatModal] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [selectedFlat, setSelectedFlat] = useState(null);
  const [wing, setWing] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [flatType, setFlatType] = useState('2BHK');
  const [areaSqFt, setAreaSqFt] = useState('');
  const [maintenanceAmount, setMaintenanceAmount] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        const data = await getSocieties();
        setSocieties(data);
        const defaultId = data[0]?.id || user?.societyId || '';
        setSelectedSocietyId(defaultId);
      } catch (err) {
        console.error('Error fetching societies:', err);
      }
    };
    fetchSocieties();
  }, [user?.societyId]);

  const fetchFlats = async () => {
    if (!selectedSocietyId) return;
    setLoading(true);
    try {
      const data = await getFlats(selectedSocietyId);
      setFlats(data);
    } catch (err) {
      console.error('Error loading flats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlats();
  }, [selectedSocietyId]);

  const handleCreateFlat = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let ownerId = null;
      if (ownerEmail) {
        const profile = await lookupProfileByEmail(ownerEmail);
        if (!profile) throw new Error('Owner email not found. Resident must sign up first.');
        ownerId = profile.id;
      }

      await createFlat({
        societyId: selectedSocietyId,
        wing,
        flatNumber,
        flatType,
        areaSqFt: parseFloat(areaSqFt),
        maintenanceAmount: maintenanceAmount ? parseFloat(maintenanceAmount) : undefined,
        ownerId,
      });

      alert('Flat registered successfully!');
      setShowFlatModal(false);
      setWing('');
      setFlatNumber('');
      setAreaSqFt('');
      setMaintenanceAmount('');
      setOwnerEmail('');
      fetchFlats();
    } catch (err) {
      alert(err.message || 'Failed to create flat.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignOwner = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await assignOwnerByEmail(selectedFlat.id, assignEmail);
      alert('Owner assigned successfully!');
      setShowOwnerModal(false);
      setAssignEmail('');
      setSelectedFlat(null);
      fetchFlats();
    } catch (err) {
      alert(err.message || 'Failed to allocate owner.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFlats = flats.filter((flat) => {
    const term = search.toLowerCase();
    return (
      flat.flatNumber.toLowerCase().includes(term) ||
      flat.wing.toLowerCase().includes(term) ||
      flat.owner?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Apartments & Inventory</h1>
          <p className="text-slate-500 text-sm">Add buildings, floors, and link them to resident owner files.</p>
        </div>
        <button
          onClick={() => setShowFlatModal(true)}
          className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2.5 shadow flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Apartment Unit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {societies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Society:</span>
            <select
              value={selectedSocietyId}
              onChange={(e) => setSelectedSocietyId(e.target.value)}
              className="flex-1 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none"
            >
              {societies.map((soc) => (
                <option key={soc.id} value={soc.id}>{soc.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by wing, flat number, or owner name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-3 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-white shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="p-4">Wing / Unit</th>
                  <th className="p-4">Flat Type</th>
                  <th className="p-4">Area (Sq. Ft.)</th>
                  <th className="p-4">Base Maintenance</th>
                  <th className="p-4">Resident Owner</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {filteredFlats.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      No flats match the criteria. Click &apos;Add Apartment Unit&apos; to create one.
                    </td>
                  </tr>
                ) : (
                  filteredFlats.map((flat) => (
                    <tr key={flat.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{flat.wing}</div>
                        <div className="text-xs text-slate-500 font-medium">Unit {flat.flatNumber}</div>
                      </td>
                      <td className="p-4">{flat.flatType}</td>
                      <td className="p-4 font-medium">{flat.areaSqFt} SqFt</td>
                      <td className="p-4 font-bold text-slate-800">₹ {flat.maintenanceAmount}</td>
                      <td className="p-4">
                        {flat.owner ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800">{flat.owner.name}</div>
                            <div className="text-xs text-slate-400">{flat.owner.email}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Vacant</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!flat.owner && (
                          <button
                            onClick={() => { setSelectedFlat(flat); setShowOwnerModal(true); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Allocate Owner
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
      )}

      {showFlatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-100 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Add New Apartment Unit</h3>
            <form onSubmit={handleCreateFlat} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required placeholder="Wing / Block" value={wing} onChange={(e) => setWing(e.target.value)} className="rounded-lg border border-slate-200 py-2 px-3 text-sm" />
                <input type="text" required placeholder="Flat Number" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} className="rounded-lg border border-slate-200 py-2 px-3 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={flatType} onChange={(e) => setFlatType(e.target.value)} className="rounded-lg border border-slate-200 py-2 px-3 text-sm">
                  <option value="1BHK">1 BHK</option>
                  <option value="2BHK">2 BHK</option>
                  <option value="3BHK">3 BHK</option>
                  <option value="4BHK">4 BHK</option>
                  <option value="Villa">Villa</option>
                </select>
                <input type="number" required placeholder="Area SqFt" value={areaSqFt} onChange={(e) => setAreaSqFt(e.target.value)} className="rounded-lg border border-slate-200 py-2 px-3 text-sm" />
              </div>
              <input type="number" placeholder="Maintenance (auto: ₹3.5/sqft)" value={maintenanceAmount} onChange={(e) => setMaintenanceAmount(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm" />
              <input type="email" placeholder="Owner email (must be registered)" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowFlatModal(false)} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Creating...' : 'Save Unit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOwnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-100 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Assign Owner — {selectedFlat?.wing} - {selectedFlat?.flatNumber}</h3>
            <form onSubmit={handleAssignOwner} className="space-y-4">
              <input type="email" required placeholder="Resident email (registered account)" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              <p className="text-[10px] text-slate-400">Resident must have signed up with role &quot;resident&quot; before assignment.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setSelectedFlat(null); setShowOwnerModal(false); }} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Assigning...' : 'Allocate Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlatsManagement;
