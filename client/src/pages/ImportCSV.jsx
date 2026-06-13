import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';

export default function ImportCSV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('error');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(`/api/groups/${id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data.stats);
      setAnomalies(data.anomalies || []);
      setSessionId(data.session_id);
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resolveAnomaly = async (anomalyId, action, value = null) => {
    try {
      await api.put(`/api/groups/${id}/import/${sessionId}/anomalies/${anomalyId}`, { user_action: action, user_value: value });
      setAnomalies(prev => prev.map(a => a.id === anomalyId ? { ...a, resolved: true, user_action: action } : a));
    } catch (err) {
      console.error('Failed to resolve:', err);
    }
  };

  const confirmImport = async () => {
    try {
      setUploading(true);
      await api.post(`/api/groups/${id}/import/${sessionId}/confirm`);
      navigate(`/groups/${id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not confirm import');
      setUploading(false);
    }
  };

  const filtered = anomalies.filter(a => a.severity === activeTab && !a.resolved);
  const unresolvedErrors = anomalies.filter(a => (a.severity === 'error' || a.severity === 'critical') && !a.resolved);

  const sevStyles = {
    error: { icon: '!', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
    warning: { icon: '⚠', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    info: { icon: 'i', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' }
  };

  return (
    <div style={{ animation: 'slide-up 0.4s ease-out' }}>
      <button onClick={() => navigate(`/groups/${id}`)} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700 mb-6 transition-colors">
        ← Back to Group
      </button>

      <h1 className="text-3xl font-extrabold gradient-text">Import CSV</h1>
      <p className="font-medium text-slate-500 mt-2 mb-8">Drop your spreadsheet export here. We'll automatically catch data issues.</p>

      {!result ? (
        <div className="glass rounded-3xl p-10 max-w-2xl shadow-sm">
          <div
            className={`border-2 border-dashed rounded-2xl p-14 text-center transition-all cursor-pointer hover:bg-brand-50/50 ${
              file ? 'border-brand-400 bg-brand-50/50' : 'border-slate-300 hover:border-brand-400'
            }`}
            onClick={() => document.getElementById('csv-input').click()}
          >
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-md mb-4 ${
              file ? 'bg-gradient-to-br from-brand-500 to-accent-500 text-white' : 'bg-white border border-slate-100'
            }`}>
              {file ? '📄' : '☁️'}
            </div>
            <p className="text-lg font-bold text-slate-800">
              {file ? file.name : 'Click or drop file here'}
            </p>
            <p className="text-sm font-medium text-slate-400 mt-2">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV files up to 5MB'}</p>
            <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>

          <div className="mt-8 flex justify-end">
            <button onClick={handleUpload} disabled={!file || uploading}
              className="px-6 py-3 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-brand-500/20 transition-all">
              {uploading ? 'Analyzing...' : 'Analyze Data'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl overflow-hidden shadow-sm max-w-4xl">
          {/* Report header */}
          <div className="px-8 py-6 border-b border-slate-100 bg-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Analysis Report</h2>
              <p className="font-medium text-slate-500 mt-0.5">
                {result.total_rows} rows processed · {result.anomaly_count} issues found
              </p>
            </div>
            <button onClick={confirmImport} disabled={unresolvedErrors.length > 0}
              className="px-6 py-3 font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-brand-500/20 transition-all hover:-translate-y-0.5">
              {unresolvedErrors.length > 0 ? `Fix ${unresolvedErrors.length} error(s) first` : 'Confirm Import'}
            </button>
          </div>

          {/* Severity tabs */}
          <div className="flex border-b border-slate-100 bg-white">
            {['error', 'warning', 'info'].map(sev => {
              const count = anomalies.filter(a => a.severity === sev && !a.resolved).length;
              return (
                <button key={sev} onClick={() => setActiveTab(sev)}
                  className={`flex-1 py-4 text-sm font-bold capitalize transition-all relative ${
                    activeTab === sev ? 'text-brand-600' : 'text-slate-400 hover:text-slate-700'
                  }`}>
                  {sev}
                  {count > 0 && <span className={`ml-2 text-xs ${sevStyles[sev].bg} ${sevStyles[sev].text} px-2 py-0.5 rounded-full font-extrabold border ${sevStyles[sev].border}`}>{count}</span>}
                  {activeTab === sev && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-brand-500 to-accent-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Anomaly list */}
          <div className="p-4 bg-slate-50/50">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-2xl mb-4 border border-emerald-100">✓</div>
                <p className="font-bold text-slate-500">No unresolved {activeTab}s remaining.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((a, i) => {
                  const sty = sevStyles[a.severity] || sevStyles.info;
                  return (
                    <div
                      key={a.id}
                      className="flex gap-4 p-5 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all"
                      style={{ animation: `slide-up 0.3s ease-out ${i * 40}ms both` }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-extrabold shrink-0 ${sty.bg} ${sty.text} ${sty.border} border shadow-sm`}>
                        {sty.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                          {a.anomaly_type.replace(/_/g, ' ')}
                        </p>
                        <p className="font-bold text-slate-800 leading-snug">{a.description}</p>

                        {a.original_data && (
                          <pre className="mt-3 bg-slate-900 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto border border-slate-800 shadow-inner">
                            {JSON.stringify(a.original_data, null, 2)}
                          </pre>
                        )}

                        <div className="flex flex-wrap gap-2.5 mt-4">
                          {a.suggested_action === 'skip' && (
                            <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-4 py-2 text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors shadow-sm">Skip Row</button>
                          )}
                          {a.suggested_action === 'modify' && (
                            <>
                              <button onClick={() => resolveAnomaly(a.id, 'accept', a.suggested_value)} className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl shadow-sm hover:shadow-md transition-all">Accept Fix</button>
                              <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-4 py-2 text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shadow-sm">Skip Row</button>
                            </>
                          )}
                          {(a.suggested_action === 'keep' || a.suggested_action === 'reclassify') && (
                            <button onClick={() => resolveAnomaly(a.id, 'accept')} className="px-4 py-2 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 shadow-sm transition-colors">
                              {a.suggested_action === 'reclassify' ? 'Reclassify as Settlement' : 'Acknowledge'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
