import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expenses');

  // Modal states
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expSplitType, setExpSplitType] = useState('equal');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expNotes, setExpNotes] = useState('');

  // Settlement form
  const [settPaidTo, setSettPaidTo] = useState('');
  const [settAmount, setSettAmount] = useState('');
  const [settDate, setSettDate] = useState(new Date().toISOString().split('T')[0]);
  const [settNotes, setSettNotes] = useState('');

  // Member form
  const [memName, setMemName] = useState('');
  const [memEmail, setMemEmail] = useState('');
  const [memJoinDate, setMemJoinDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [gRes, eRes, bRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/groups/${id}/expenses?limit=50`),
        api.get(`/api/groups/${id}/balances`)
      ]);
      setGroup(gRes.data);
      setExpenses(eRes.data.expenses || []);
      setBalances(bRes.data || []);
      try {
        const sRes = await api.get(`/api/groups/${id}/simplified-debts`);
        setSimplifiedDebts(sRes.data.transactions || []);
      } catch { setSimplifiedDebts([]); }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (e) => {
    e.preventDefault();
    if (!editGroupName.trim()) return;
    try {
      await api.put(`/api/groups/${id}`, { name: editGroupName, description: editGroupDesc });
      setShowEditGroup(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update group');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/groups/${id}`);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/groups/${id}/expenses`, {
        description: expDesc,
        amount: parseFloat(expAmount),
        expense_date: expDate,
        split_type: expSplitType,
        currency: expCurrency,
        notes: expNotes,
        paid_by: user.id
      });
      setShowExpenseForm(false);
      setExpDesc(''); setExpAmount(''); setExpNotes('');
      setExpSplitType('equal'); setExpCurrency('INR');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add expense');
    }
  };

  const handleAddSettlement = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/groups/${id}/settlements`, {
        paid_by: user.id,
        paid_to: parseInt(settPaidTo),
        amount: parseFloat(settAmount),
        settlement_date: settDate,
        notes: settNotes
      });
      setShowSettlementForm(false);
      setSettPaidTo(''); setSettAmount(''); setSettNotes('');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record settlement');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/groups/${id}/members`, {
        email: memEmail,
        name: memName,
        joined_at: memJoinDate
      });
      setShowMemberForm(false);
      setMemName(''); setMemEmail('');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleSetLeaveDate = async (memberId) => {
    const leaveDate = prompt('Enter leave date (YYYY-MM-DD):');
    if (!leaveDate) return;
    try {
      await api.put(`/api/groups/${id}/members/${memberId}`, { left_at: leaveDate });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update member');
    }
  };

  const fetchBreakdown = async (userId) => {
    if (showBreakdown === userId) { setShowBreakdown(null); setBreakdown(null); return; }
    try {
      const { data } = await api.get(`/api/groups/${id}/balances/${userId}`);
      setBreakdown(data);
      setShowBreakdown(userId);
    } catch (err) {
      console.error('Failed to load breakdown:', err);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div></div>;
  if (!group) return <p className="text-center py-20 font-bold text-slate-400">Group not found</p>;

  const tabs = [
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'balances', label: 'Balances', count: balances.length },
    { key: 'members', label: 'Members', count: group.members?.length || 0 },
  ];

  const activeMembers = group.members?.filter(m => !m.left_at) || [];

  return (
    <div style={{ animation: 'slide-up 0.4s ease-out' }}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700 mb-6 transition-colors">
        ← Back to Dashboard
      </Link>

      <div className="glass rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white/50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-accent-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
              {group.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-800">{group.name}</h1>
                <button 
                  onClick={() => { setEditGroupName(group.name); setEditGroupDesc(group.description || ''); setShowEditGroup(true); }}
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  title="Edit Group"
                >
                  ⚙️
                </button>
              </div>
              {group.description && <p className="font-medium text-slate-500 mt-0.5">{group.description}</p>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to={`/groups/${id}/import`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl text-sm hover:-translate-y-0.5 shadow-md transition-all">
              📄 Import CSV
            </Link>
            <button onClick={() => setShowExpenseForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:border-brand-300 hover:shadow-md transition-all">
              + Expense
            </button>
            <button onClick={() => setShowSettlementForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:border-emerald-300 hover:shadow-md transition-all">
              💰 Settle
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-white">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-4 text-sm font-bold capitalize transition-all relative ${
                tab === t.key ? 'text-brand-600' : 'text-slate-400 hover:text-slate-700'
              }`}>
              {t.label}
              <span className="ml-1.5 text-xs opacity-60">({t.count})</span>
              {tab === t.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-brand-500 to-accent-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 bg-slate-50/50">
          {tab === 'expenses' && (
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="font-medium text-slate-400">No expenses yet.</p>
                  <button onClick={() => setShowExpenseForm(true)} className="mt-4 px-4 py-2 font-bold text-brand-600 bg-brand-50 border border-brand-100 rounded-xl text-sm hover:bg-brand-100 transition-colors">
                    + Add First Expense
                  </button>
                </div>
              ) : (
                expenses.map((e, i) => {
                  const dt = new Date(e.expense_date);
                  return (
                    <div key={e.id}
                      className="flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:shadow-md transition-all group"
                      style={{ animation: `slide-up 0.3s ease-out ${i * 40}ms both` }}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center text-xs group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                          <span className="text-base font-extrabold text-slate-800">{dt.getDate()}</span>
                          <span className="uppercase text-[10px] font-bold text-slate-400">{dt.toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{e.description}</p>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Paid by <span className="font-bold text-slate-700">{e.paid_by_name}</span>
                            <span className="ml-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{e.split_type}</span>
                            {e.is_settlement && <span className="ml-1 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">Settlement</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-extrabold text-slate-800 tracking-tight">
                          {e.currency === 'USD' ? '$' : '₹'}{parseFloat(e.amount).toFixed(2)}
                        </p>
                        {e.currency === 'USD' && <p className="text-xs font-bold text-slate-400">₹{parseFloat(e.amount_in_base).toFixed(2)}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'balances' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {balances.map((b, i) => (
                  <div key={b.user_id} style={{ animation: `slide-up 0.3s ease-out ${i * 60}ms both` }}>
                    <div
                      onClick={() => fetchBreakdown(b.user_id)}
                      className={`flex items-center justify-between p-5 bg-white border rounded-2xl transition-all shadow-sm cursor-pointer hover:shadow-md ${
                        b.balance > 0.01 ? 'border-l-4 border-l-emerald-400 border-slate-100' : b.balance < -0.01 ? 'border-l-4 border-l-rose-400 border-slate-100' : 'border-slate-100'
                      } ${showBreakdown === b.user_id ? 'ring-2 ring-brand-200' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 flex items-center justify-center text-lg font-extrabold border border-brand-200">
                          {b.name.charAt(0)}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800">{b.name}</p>
                          <p className="text-xs font-medium text-brand-500">Click for audit trail →</p>
                        </div>
                      </div>
                      <div>
                        {b.balance > 0.01 ? (
                          <span className="font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl text-sm">gets ₹{b.balance.toFixed(2)}</span>
                        ) : b.balance < -0.01 ? (
                          <span className="font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl text-sm">owes ₹{Math.abs(b.balance).toFixed(2)}</span>
                        ) : (
                          <span className="font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-sm">settled up</span>
                        )}
                      </div>
                    </div>

                    {/* Rohan's Audit Trail — per-expense breakdown */}
                    {showBreakdown === b.user_id && breakdown && (
                      <div className="mt-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" style={{ animation: 'slide-up 0.25s ease-out' }}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-extrabold text-slate-800">Balance Breakdown — {b.name}</h4>
                          <span className="text-xs font-bold bg-brand-50 text-brand-700 px-3 py-1 rounded-full border border-brand-100">
                            Net: ₹{breakdown.net_balance?.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-emerald-600 mb-1">Paid for others</p>
                            <p className="text-lg font-extrabold text-emerald-700">₹{breakdown.total_paid_for_others?.toFixed(2)}</p>
                          </div>
                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-rose-600 mb-1">Owes to others</p>
                            <p className="text-lg font-extrabold text-rose-700">₹{breakdown.total_owed_to_others?.toFixed(2)}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-blue-600 mb-1">Settlements</p>
                            <p className="text-lg font-extrabold text-blue-700">₹{breakdown.settlements_net?.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {breakdown.expenses?.map(exp => (
                            <div key={exp.expense_id} className={`flex justify-between items-center px-4 py-3 rounded-lg text-sm ${
                              exp.type === 'paid' ? 'bg-emerald-50/50' : 'bg-rose-50/50'
                            }`}>
                              <div>
                                <p className="font-bold text-slate-700">{exp.description}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{exp.explanation}</p>
                              </div>
                              <span className={`font-extrabold ${exp.type === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {exp.type === 'paid' ? '+' : '-'}₹{Math.abs(exp.net_effect).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {simplifiedDebts.length > 0 && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-7 shadow-xl">
                  <h3 className="text-lg font-extrabold text-white mb-1">Suggested Settlements</h3>
                  <p className="font-medium text-slate-400 mb-5 text-sm">Minimum transactions to settle all balances.</p>
                  <div className="space-y-3">
                    {simplifiedDebts.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 px-5 py-4 rounded-xl backdrop-blur">
                        <span className="font-bold text-slate-300">{t.from.name} <span className="text-brand-400 mx-2">→</span> {t.to.name}</span>
                        <span className="font-extrabold text-emerald-400 tracking-tight">₹{t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowMemberForm(true)} className="px-4 py-2 font-bold text-brand-600 bg-brand-50 border border-brand-100 rounded-xl text-sm hover:bg-brand-100 transition-colors">
                  + Add Member
                </button>
              </div>
              {group.members.map((m, i) => (
                <div key={m.id}
                  className="flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all"
                  style={{ animation: `slide-up 0.3s ease-out ${i * 50}ms both` }}>
                  <div className="flex items-center gap-4">
                    <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 flex items-center justify-center font-extrabold border border-brand-200">
                      {m.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">
                        {m.name}
                        {m.role === 'admin' && <span className="ml-2 text-[10px] font-extrabold uppercase bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md border border-brand-200">Admin</span>}
                      </p>
                      <p className="text-sm font-medium text-slate-400">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                        {m.left_at && <span className="ml-1">· Left {new Date(m.left_at).toLocaleDateString()}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.left_at ? (
                      <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">Inactive</span>
                    ) : (
                      <>
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">Active</span>
                        <button onClick={() => handleSetLeaveDate(m.id)} className="text-xs font-bold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-all">
                          Set Leave
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: 'fade-in 0.2s ease-out' }} onClick={() => setShowExpenseForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ animation: 'slide-up 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Add Expense</h2>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="px-7 py-5 space-y-4 bg-slate-50/50">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
                  <input type="text" required value={expDesc} onChange={e => setExpDesc(e.target.value)} autoFocus
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all shadow-sm"
                    placeholder="e.g. Groceries BigBasket" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Amount</label>
                    <input type="number" step="0.01" required value={expAmount} onChange={e => setExpAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all shadow-sm"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Currency</label>
                    <select value={expCurrency} onChange={e => setExpCurrency(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm">
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Date</label>
                    <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Split Type</label>
                    <select value={expSplitType} onChange={e => setExpSplitType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm">
                      <option value="equal">Equal</option>
                      <option value="exact">Exact</option>
                      <option value="percentage">Percentage</option>
                      <option value="shares">Shares</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes (optional)</label>
                  <input type="text" value={expNotes} onChange={e => setExpNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="Any additional notes" />
                </div>
              </div>
              <div className="px-7 py-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowExpenseForm(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-md text-sm transition-all">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Settlement Modal */}
      {showSettlementForm && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: 'fade-in 0.2s ease-out' }} onClick={() => setShowSettlementForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ animation: 'slide-up 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Record Settlement</h2>
              <p className="text-sm text-slate-500 mt-1">Record a payment you made to settle a debt.</p>
            </div>
            <form onSubmit={handleAddSettlement}>
              <div className="px-7 py-5 space-y-4 bg-slate-50/50">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Paid To</label>
                  <select required value={settPaidTo} onChange={e => setSettPaidTo(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm">
                    <option value="">Select member...</option>
                    {activeMembers.filter(m => m.user_id !== user.id).map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Amount (₹)</label>
                    <input type="number" step="0.01" required value={settAmount} onChange={e => setSettAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Date</label>
                    <input type="date" value={settDate} onChange={e => setSettDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes (optional)</label>
                  <input type="text" value={settNotes} onChange={e => setSettNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="e.g. Settling March expenses" />
                </div>
              </div>
              <div className="px-7 py-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowSettlementForm(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl shadow-md text-sm transition-all">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberForm && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: 'fade-in 0.2s ease-out' }} onClick={() => setShowMemberForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ animation: 'slide-up 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Add Member</h2>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="px-7 py-5 space-y-4 bg-slate-50/50">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Name</label>
                  <input type="text" required value={memName} onChange={e => setMemName(e.target.value)} autoFocus
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="e.g. Sam" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                  <input type="email" required value={memEmail} onChange={e => setMemEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="sam@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Join Date</label>
                  <input type="date" value={memJoinDate} onChange={e => setMemJoinDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm" />
                </div>
              </div>
              <div className="px-7 py-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowMemberForm(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-md text-sm transition-all">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: 'fade-in 0.2s ease-out' }} onClick={() => setShowEditGroup(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ animation: 'slide-up 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-slate-800">Group Settings</h2>
              <button type="button" onClick={handleDeleteGroup} className="text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors">
                Delete Group
              </button>
            </div>
            <form onSubmit={handleEditGroup}>
              <div className="px-7 py-5 space-y-4 bg-slate-50/50">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Group Name</label>
                  <input type="text" required value={editGroupName} onChange={e => setEditGroupName(e.target.value)} autoFocus
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="e.g. Flat 402" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Description (optional)</label>
                  <textarea rows={3} value={editGroupDesc} onChange={e => setEditGroupDesc(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all shadow-sm"
                    placeholder="What is this group for?" />
                </div>
              </div>
              <div className="px-7 py-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowEditGroup(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-md text-sm transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
