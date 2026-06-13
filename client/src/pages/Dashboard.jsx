import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/api/groups');
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/api/groups', { name, description: desc });
      setShowModal(false);
      setName('');
      setDesc('');
      fetchGroups();
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-10 border-b border-slate-200 pb-6">
          <div>
            <div className="w-48 h-8 bg-slate-200 rounded-md mb-3"></div>
            <div className="w-64 h-4 bg-slate-200 rounded-md"></div>
          </div>
          <div className="w-32 h-10 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 h-36 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                <div className="w-20 h-6 bg-slate-200 rounded-md"></div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="w-3/4 h-5 bg-slate-200 rounded-md"></div>
                <div className="w-1/2 h-4 bg-slate-200 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }} className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Select a group or create a new one.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors text-sm"
        >
          <span className="text-lg leading-none font-normal">+</span> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 text-xl">
            +
          </div>
          <h3 className="text-base font-extrabold text-slate-800 mb-1">No groups found</h3>
          <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto mb-6">
            You aren't part of any shared expense groups yet. Create one to get started.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm shadow-sm"
          >
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g, i) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-400 hover:shadow-md transition-all group relative"
              style={{ animation: `slide-up 0.4s ease-out ${i * 50}ms both` }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight group-hover:text-slate-700 transition-colors">{g.name}</h3>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border border-slate-200 px-2 py-1 rounded shrink-0 mt-1">
                    {g.active_members} members
                  </div>
                </div>
                <div className="w-6 h-1 bg-slate-200 rounded-full mb-3 group-hover:bg-slate-300 transition-colors"></div>
                <p className="text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed">
                  {g.description || 'No description provided.'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: 'fade-in 0.2s ease-out' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200"
            style={{ animation: 'slide-up 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Create New Group</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-6 py-6 space-y-5 bg-slate-50">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Group Name</label>
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)} autoFocus
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors sm:text-sm shadow-sm"
                    placeholder="e.g. Flat 402"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors sm:text-sm shadow-sm"
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm transition-colors text-sm">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
