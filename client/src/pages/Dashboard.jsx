import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { Plus, Users, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/api/groups');
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      await api.post('/api/groups', {
        name: newGroupName,
        description: newGroupDesc
      });
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      fetchGroups();
    } catch (error) {
      console.error('Failed to create group', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Groups</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage your shared expenses and see who owes what.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 px-4 sm:px-6 lg:px-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Users className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="mt-2 text-lg font-medium text-slate-900">No groups yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Get started by creating a new group for your flatmates or a recent trip.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-5 w-5 mr-2 -ml-1" />
              Create Group
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="group flex flex-col justify-between bg-white overflow-hidden rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-inner">
                    <span className="text-white font-bold text-xl">{group.name.charAt(0)}</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {group.active_members} members
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                    {group.description || 'No description provided'}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">
                  View details
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setIsCreateModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200">
              <form onSubmit={handleCreateGroup}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                      <Users className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                        Create New Group
                      </h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-slate-700">Group Name</label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g. Flat 402, Goa Trip"
                          />
                        </div>
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-slate-700">Description (Optional)</label>
                          <textarea
                            id="description"
                            name="description"
                            rows="3"
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                            className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="What is this group for?"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-200">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Create Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
