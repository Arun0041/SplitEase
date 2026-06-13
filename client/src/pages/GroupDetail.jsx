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

  return (
    <div className="animate-[fade-in_0.3s_ease-out]">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-800 mb-6 transition-colors">
        ← Back to Dashboard
      </Link>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-inner">
              {group.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">{group.name}</h1>
              {group.description && <p className="font-medium text-slate-500 mt-1">{group.description}</p>}
            </div>
          </div>
          <Link to={`/groups/${id}/import`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 hover:-translate-y-0.5 shadow-sm transition-all">
            📄 Import CSV
          </Link>
        </div>

        <div className="flex border-t border-b border-slate-100 bg-white">
          {['expenses', 'balances', 'members'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-bold capitalize border-b-2 transition-all ${
                tab === t ? 'text-brand-600 border-brand-600 bg-brand-50/30' : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}>
              {t} {t === 'members' && <span className="ml-1 opacity-60">({group.members?.length || 0})</span>}
            </button>
          ))}
        </div>

        <div className="p-8 bg-stone-50/30">
          {tab === 'expenses' && (
            <div className="space-y-4">
              {expenses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="font-medium text-slate-400">No expenses yet. Time to add some!</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {expenses.map(e => {
                    const dt = new Date(e.expense_date);
                    return (
                      <div key={e.id} className="flex items-center justify-between px-6 py-5 border-b border-slate-50 last:border-0 hover:bg-brand-50/50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center text-xs text-slate-500 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                            <span className="text-base font-extrabold text-slate-800">{dt.getDate()}</span>
                            <span className="uppercase text-[10px] font-bold">{dt.toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{e.description}</p>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">
                              Paid by <span className="font-bold text-slate-700">{e.paid_by_name}</span>
                              {e.is_settlement && <span className="ml-2 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Settlement</span>}
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
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'balances' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {balances.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between p-5 bg-white border border-slate-100 shadow-sm rounded-2xl hover:border-brand-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-lg font-extrabold shadow-sm">
                        {b.name.charAt(0)}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">{b.name}</p>
                        <p className="text-sm font-medium text-slate-400">{b.email}</p>
                      </div>
                    </div>
                    <div>
                      {b.balance > 0.01 ? (
                        <span className="font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">gets ₹{b.balance.toFixed(2)}</span>
                      ) : b.balance < -0.01 ? (
                        <span className="font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl">owes ₹{Math.abs(b.balance).toFixed(2)}</span>
                      ) : (
                        <span className="font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl">settled up</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {simplifiedDebts.length > 0 && (
                <div className="bg-slate-900 rounded-3xl p-7 shadow-lg">
                  <h3 className="text-lg font-extrabold text-white mb-1">Suggested Settlements</h3>
                  <p className="font-medium text-slate-400 mb-5">Minimum transactions to settle all balances.</p>
                  <div className="space-y-3">
                    {simplifiedDebts.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800 border border-slate-700 px-5 py-4 rounded-2xl">
                        <span className="font-bold text-slate-300">{t.from.name} <span className="text-slate-500 mx-2">→</span> {t.to.name}</span>
                        <span className="font-extrabold text-emerald-400 tracking-tight">₹{t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'members' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {group.members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-6 py-5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-extrabold shadow-sm">
                      {m.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">
                        {m.name} {m.role === 'admin' && <span className="ml-2 text-[10px] font-extrabold uppercase bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md">Admin</span>}
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
