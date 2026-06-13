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
    return <div className="flex justify-center py-20"><div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Your Groups</h1>
          <p className="text-sm text-slate-500 mt-1">Manage shared expenses and see who owes what.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
          <span className="text-lg leading-none">+</span> New Group
        </button>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <div className="mx-auto w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-2xl">👥</div>
          <h3 className="text-base font-semibold text-slate-900">No groups yet</h3>
          <p className="text-sm text-slate-400 mt-1">Create a group for your flatmates or a trip.</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors">
            + Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map(g => (
            <Link key={g.id} to={`/groups/${g.id}`} className="bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {g.name.charAt(0)}
                  </div>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {g.active_members} members
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mt-3 group-hover:text-indigo-600 transition-colors">{g.name}</h3>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{g.description || 'No description'}</p>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-slate-500 group-hover:text-indigo-600 transition-colors">
                View details <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Create New Group</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Group Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Flat 402, Goa Trip" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (optional)</label>
                  <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="What is this group for?" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
