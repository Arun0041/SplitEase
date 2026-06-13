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

  if (loading) return <div className="flex justify-center py-32"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div></div>;
  if (!group) return <p className="text-center py-20 font-bold text-slate-400">Group not found</p>;

  const tabs = [
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'balances', label: 'Balances', count: balances.length },
    { key: 'members', label: 'Members', count: group.members?.length || 0 },
  ];

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
              <h1 className="text-2xl font-extrabold text-slate-800">{group.name}</h1>
              {group.description && <p className="font-medium text-slate-500 mt-0.5">{group.description}</p>}
            </div>
          </div>
          <Link to={`/groups/${id}/import`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl hover:-translate-y-0.5 shadow-md hover:shadow-lg hover:shadow-brand-500/20 transition-all">
            📄 Import CSV
          </Link>
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
                  <p className="font-medium text-slate-400">No expenses yet. Time to add some!</p>
                </div>
              ) : (
                expenses.map((e, i) => {
                  const dt = new Date(e.expense_date);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:shadow-md transition-all group"
                      style={{ animation: `slide-up 0.3s ease-out ${i * 40}ms both` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center text-xs group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                          <span className="text-base font-extrabold text-slate-800">{dt.getDate()}</span>
                          <span className="uppercase text-[10px] font-bold text-slate-400">{dt.toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{e.description}</p>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Paid by <span className="font-bold text-slate-700">{e.paid_by_name}</span>
                            {e.is_settlement && <span className="ml-2 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">Settlement</span>}
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
                  <div
                    key={b.user_id}
                    className={`flex items-center justify-between p-5 bg-white border rounded-2xl transition-all shadow-sm ${
                      b.balance > 0.01 ? 'border-l-4 border-l-emerald-400 border-slate-100' : b.balance < -0.01 ? 'border-l-4 border-l-rose-400 border-slate-100' : 'border-slate-100'
                    }`}
                    style={{ animation: `slide-up 0.3s ease-out ${i * 60}ms both` }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 flex items-center justify-center text-lg font-extrabold border border-brand-200">
                        {b.name.charAt(0)}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">{b.name}</p>
                        <p className="text-sm font-medium text-slate-400">{b.email}</p>
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
              {group.members.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all"
                  style={{ animation: `slide-up 0.3s ease-out ${i * 50}ms both` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 flex items-center justify-center font-extrabold border border-brand-200">
                      {m.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">
                        {m.name}
                        {m.role === 'admin' && <span className="ml-2 text-[10px] font-extrabold uppercase bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md border border-brand-200">Admin</span>}
                      </p>
                      <p className="text-sm font-medium text-slate-400">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {m.left_at ? (
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">Inactive</span>
                  ) : (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">Active</span>
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
