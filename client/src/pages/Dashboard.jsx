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
      <div className="flex justify-center items-center py-32">
        <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const colors = [
    'from-brand-500 to-accent-400',
    'from-rose-500 to-orange-400',
    'from-emerald-500 to-teal-400',
    'from-blue-500 to-indigo-400',
    'from-amber-500 to-yellow-400',
    'from-pink-500 to-fuchsia-400',
  ];

  return (
    <div style={{ animation: 'slide-up 0.4s ease-out' }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold gradient-text">Your Groups</h1>
          <p className="font-medium text-slate-400 mt-1">Manage shared expenses effortlessly.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl hover:-translate-y-0.5 shadow-lg hover:shadow-brand-500/25 transition-all"
        >
          <span className="text-xl leading-none">+</span> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 glass rounded-3xl">
          <div className="mx-auto w-16 h-16 bg-brand-600/20 text-brand-400 rounded-2xl flex items-center justify-center mb-4 text-3xl">
            🏖️
          </div>
          <h3 className="text-lg font-bold text-white">No groups yet</h3>
          <p className="font-medium text-slate-400 mt-1 max-w-sm mx-auto">Create a group for your flatmates, a weekend trip, or your partner.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-5 py-2.5 font-bold text-brand-400 glass-light rounded-xl hover:text-brand-300 transition-colors"
          >
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((g, i) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="glass rounded-2xl overflow-hidden card-hover group relative"
              style={{ animation: `slide-up 0.4s ease-out ${i * 80}ms both` }}
            >
              {/* Gradient accent bar */}
              <div className={`h-1 bg-gradient-to-r ${colors[i % colors.length]}`} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${colors[i % colors.length]} rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg`}>
                    {g.name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold glass-light text-slate-300 px-3 py-1 rounded-full">
                    {g.active_members} members
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">{g.name}</h3>
                <p className="text-sm font-medium text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {g.description || 'No description provided.'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: 'fade-in 0.2s ease-out' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="glass rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            style={{ animation: 'slide-up 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 py-6 border-b border-white/5">
              <h2 className="text-xl font-extrabold text-white">Create New Group</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-7 py-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Group Name</label>
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)} autoFocus
                    className="w-full px-4 py-3 glass-light rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                    placeholder="e.g. Flat 402, Goa Trip"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Description</label>
                  <textarea
                    rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                    className="w-full px-4 py-3 glass-light rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                    placeholder="What is this group for?"
                  />
                </div>
              </div>
              <div className="px-7 py-5 border-t border-white/5 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold text-slate-400 glass-light rounded-xl hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-lg hover:shadow-brand-500/25 transition-all">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
