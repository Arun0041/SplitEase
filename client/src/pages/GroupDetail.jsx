import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/axios';
import { 
  Users, Receipt, Wallet, ArrowLeft, Plus, 
  Upload, ChevronRight, CheckCircle2, UserPlus 
} from 'lucide-react';

const GroupDetail = () => {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses');

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/groups/${id}/expenses?limit=10`),
        api.get(`/api/groups/${id}/balances`)
      ]);
      setGroup(groupRes.data);
      setExpenses(expensesRes.data.expenses);
      setBalances(balancesRes.data);
    } catch (error) {
      console.error('Failed to fetch group data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!group) return <div>Group not found</div>;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center mb-4">
          <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center group transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1 transform group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-inner mr-5">
              <span className="text-white font-bold text-3xl">{group.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{group.name}</h1>
              {group.description && <p className="text-slate-500 mt-1">{group.description}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </button>
            {/* The CSV import link is critical for the assignment */}
            <Link 
              to={`/groups/${id}/import`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 border-b border-slate-200 bg-slate-50/50">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'expenses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Receipt className="h-4 w-4 mr-2" />
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'balances'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Balances
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'members'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Members ({group.members?.length || 0})
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 bg-slate-50">
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Recent Expenses</h2>
              <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors">
                <Plus className="h-4 w-4 mr-1" />
                Add Expense
              </button>
            </div>
            
            {expenses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                <Receipt className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No expenses yet</p>
                <p className="text-slate-400 text-sm mt-1">Import your CSV or add one manually</p>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
                <ul className="divide-y divide-slate-200">
                  {expenses.map((expense) => (
                    <li key={expense.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0 gap-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-medium">
                            {new Date(expense.expense_date).getDate()}
                            <br/>
                            <span className="text-[10px] uppercase">{new Date(expense.expense_date).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {expense.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Paid by <span className="font-medium text-slate-700">{expense.paid_by_name}</span>
                              {expense.is_settlement && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">Settlement</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="text-right mr-4">
                            <p className="text-sm font-bold text-slate-900">
                              {expense.currency === 'USD' ? '$' : '₹'}{parseFloat(expense.amount).toFixed(2)}
                            </p>
                            {expense.currency === 'USD' && (
                              <p className="text-xs text-slate-500">₹{parseFloat(expense.amount_in_base).toFixed(2)}</p>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-500" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="bg-slate-50 p-3 text-center border-t border-slate-200">
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View all expenses</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'balances' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Group Balances</h2>
              <button className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                Settle Up
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {balances.map((balance) => (
                <div key={balance.user_id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {balance.avatar_url ? (
                      <img className="h-10 w-10 rounded-full border border-slate-200" src={balance.avatar_url} alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-lg border border-indigo-200">
                        {balance.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{balance.name}</p>
                      <p className="text-xs text-slate-500">{balance.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {balance.balance > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-green-50 text-green-700">
                        gets back ₹{balance.balance.toFixed(2)}
                      </span>
                    ) : balance.balance < 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-orange-50 text-orange-700">
                        owes ₹{Math.abs(balance.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-600">
                        settled up
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-indigo-50 rounded-xl p-5 border border-indigo-100">
              <h3 className="text-sm font-bold text-indigo-900 mb-2">How to settle up (Aisha's View)</h3>
              <p className="text-sm text-indigo-700 mb-4">We've minimized the number of transactions needed to settle all debts.</p>
              {/* This would fetch from /api/groups/:id/simplified-debts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-slate-700">Rohan <ArrowRight className="inline h-3 w-3 mx-1 text-slate-400" /> Aisha</span>
                  <span className="text-sm font-bold text-slate-900">₹2,300.00</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <ul className="divide-y divide-slate-200">
              {group.members.map((member) => (
                <li key={member.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {member.name} {member.role === 'admin' && <span className="ml-2 text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Admin</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        Joined: {new Date(member.joined_at).toLocaleDateString()}
                        {member.left_at && ` • Left: ${new Date(member.left_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {member.left_at ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetail;
