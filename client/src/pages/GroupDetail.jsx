import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/axios';

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expenses');

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [gRes, eRes, bRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/groups/${id}/expenses?limit=20`),
        api.get(`/api/groups/${id}/balances`)
      ]);
      setGroup(gRes.data);
      setExpenses(eRes.data.expenses || []);
      setBalances(bRes.data || []);

      // Try loading simplified debts (may fail if no data yet)
      try {
        const sRes = await api.get(`/api/groups/${id}/simplified-debts`);
        setSimplifiedDebts(sRes.data.transactions || []);
      } catch { setSimplifiedDebts([]); }
    } catch (err) {
      console.error('Failed to load group:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!group) return <p className="text-center py-20 text-slate-500">Group not found</p>;

  const formatDate = (d) => {
    const dt = new Date(d);
    return { day: dt.getDate(), month: dt.toLocaleString('default', { month: 'short' }) };
  };

  return (
    <div>
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
        ← Back to Dashboard
      </Link>

      {/* Group header */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
              {group.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{group.name}</h1>
              {group.description && <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <Link to={`/groups/${id}/import`} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
              📄 Import CSV
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-200 bg-slate-50/50">
          {['expenses', 'balances', 'members'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}>
              {t} {t === 'members' && `(${group.members?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-slate-50 p-6">

          {/* ── Expenses tab ── */}
          {tab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Recent Expenses</h2>
              </div>

              {expenses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm">No expenses yet. Import your CSV or add one manually.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {expenses.map(e => {
                    const { day, month } = formatDate(e.expense_date);
                    return (
                      <div key={e.id} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-xs text-slate-500 leading-tight">
                            <span className="text-base font-bold text-slate-800">{day}</span>
                            <span className="uppercase text-[10px]">{month}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{e.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Paid by <span className="font-medium text-slate-600">{e.paid_by_name}</span>
                              {e.is_settlement && <span className="ml-2 text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Settlement</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {e.currency === 'USD' ? '$' : '₹'}{parseFloat(e.amount).toFixed(2)}
                          </p>
                          {e.currency === 'USD' && (
                            <p className="text-xs text-slate-400">₹{parseFloat(e.amount_in_base).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Balances tab ── */}
          {tab === 'balances' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-4">Net Balances</h2>

              {balances.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">No balance data yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {balances.map(b => (
                    <div key={b.user_id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-semibold">
                          {b.name.charAt(0)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{b.name}</p>
                          <p className="text-xs text-slate-400">{b.email}</p>
                        </div>
                      </div>
                      <div>
                        {b.balance > 0.01 ? (
                          <span className="text-sm font-bold text-green-600">gets back ₹{b.balance.toFixed(2)}</span>
                        ) : b.balance < -0.01 ? (
                          <span className="text-sm font-bold text-red-500">owes ₹{Math.abs(b.balance).toFixed(2)}</span>
                        ) : (
                          <span className="text-sm font-medium text-slate-400">settled up</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Simplified debts section (Aisha's requirement) */}
              {simplifiedDebts.length > 0 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-blue-900 mb-1">How to settle up</h3>
                  <p className="text-xs text-blue-700 mb-3">Minimum transactions needed to clear all debts.</p>
                  <div className="space-y-2">
                    {simplifiedDebts.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg text-sm">
                        <span className="font-medium text-slate-700">{t.from.name} → {t.to.name}</span>
                        <span className="font-bold text-slate-900">₹{t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Members tab ── */}
          {tab === 'members' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {group.members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-medium">
                      {m.name.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {m.name}
                        {m.role === 'admin' && <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Admin</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        Joined: {new Date(m.joined_at).toLocaleDateString()}
                        {m.left_at && ` · Left: ${new Date(m.left_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {m.left_at ? (
                    <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">Inactive</span>
                  ) : (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Active</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
