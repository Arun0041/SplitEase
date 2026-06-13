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
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="animate-[fade-in_0.3s_ease-out]">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Your Groups</h1>
          <p className="font-medium text-slate-500 mt-1">Manage shared expenses effortlessly.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 hover:-translate-y-0.5 shadow-sm hover:shadow transition-all">
          <span className="text-xl leading-none">+</span> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
          <div className="mx-auto w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-inner">
            🏖️
          </div>
          <h3 className="text-lg font-bold text-slate-800">No groups yet</h3>
          <p className="font-medium text-slate-500 mt-1 max-w-sm mx-auto">Create a group for your flatmates, a weekend trip, or your partner.</p>
          <button onClick={() => setShowModal(true)} className="mt-6 px-5 py-2.5 font-bold text-brand-700 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors">
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g, i) => (
            <Link 
              key={g.id} 
              to={`/groups/${g.id}`} 
              className="bg-white border border-slate-100 rounded-3xl hover:border-brand-200 hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-inner">
                    {g.name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold bg-slate-50 border border-slate-100 text-slate-500 px-3 py-1 rounded-full">
                    {g.active_members} members
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{g.name}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {g.description || 'No description provided.'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-100 transition-transform" onClick={e => e.stopPropagation()}>
            <div className="px-7 py-6 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-800">Create New Group</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-7 py-6 space-y-5 bg-slate-50/50">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Group Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} autoFocus
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all shadow-sm"
                    placeholder="e.g. Flat 402, Goa Trip" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all shadow-sm"
                    placeholder="What is this group for?" />
                </div>
              </div>
              <div className="px-7 py-5 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-colors">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
