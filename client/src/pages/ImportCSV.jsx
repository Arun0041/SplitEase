import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';

export default function ImportCSV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);      // stats from analysis
  const [anomalies, setAnomalies] = useState([]);   // list of flagged issues
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
      await api.put(`/api/groups/${id}/import/${sessionId}/anomalies/${anomalyId}`, {
        user_action: action,
        user_value: value
      });
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
  const severityIcon = { error: '✕', warning: '⚠', info: 'ℹ' };
  const severityBg = { error: 'bg-red-50 text-red-600', warning: 'bg-amber-50 text-amber-600', info: 'bg-blue-50 text-blue-600' };

  return (
    <div>
      <button onClick={() => navigate(`/groups/${id}`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
        ← Back to Group
      </button>

      <h1 className="text-xl font-bold text-slate-900">Import Expenses CSV</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">Upload your spreadsheet export. We'll flag any data problems for you to review before importing.</p>

      {/* ── Upload section ── */}
      {!result ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-2xl">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              file ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'
            }`}
            onClick={() => document.getElementById('csv-input').click()}
          >
            <p className="text-3xl mb-2">{file ? '📄' : '☁️'}</p>
            <p className="text-sm text-slate-600">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV files up to 5MB'}</p>
            <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={handleUpload} disabled={!file || uploading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors">
              {uploading ? 'Analyzing…' : 'Analyze CSV'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Analysis report ── */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-4xl">
          {/* Report header */}
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Analysis Report</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {result.total_rows} rows processed · {result.anomaly_count} issues found
              </p>
            </div>
            <button onClick={confirmImport} disabled={unresolvedErrors.length > 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
              {unresolvedErrors.length > 0 ? `Resolve ${unresolvedErrors.length} error(s) first` : 'Confirm Import'}
            </button>
          </div>

          {/* Severity tabs */}
          <div className="flex border-b border-slate-200">
            {['error', 'warning', 'info'].map(sev => {
              const count = anomalies.filter(a => a.severity === sev && !a.resolved).length;
              const colors = {
                error:   tab === sev ? 'text-red-600 border-red-500 bg-red-50' : '',
                warning: tab === sev ? 'text-amber-600 border-amber-500 bg-amber-50' : '',
                info:    tab === sev ? 'text-blue-600 border-blue-500 bg-blue-50' : ''
              };
              const tab = activeTab;
              return (
                <button key={sev} onClick={() => setActiveTab(sev)}
                  className={`flex-1 py-3.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
                    activeTab === sev ? colors[sev] : 'text-slate-500 border-transparent hover:bg-slate-50'
                  }`}>
                  {sev}
                  {count > 0 && <span className="ml-1.5 text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-full font-bold">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Anomaly list */}
          <div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-2xl mb-2">✓</p>
                <p className="text-sm">No unresolved {activeTab}s remaining.</p>
              </div>
            ) : (
              filtered.map(a => (
                <div key={a.id || `${a.row_number}-${a.anomaly_type}`} className="flex gap-4 px-6 py-5 border-b border-slate-100 last:border-b-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 ${severityBg[a.severity]}`}>
                    {severityIcon[a.severity]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {a.anomaly_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">{a.description}</p>

                    {a.original_data && typeof a.original_data === 'object' && (
                      <pre className="mt-2 bg-slate-100 p-2.5 rounded-lg text-[11px] text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(a.original_data, null, 1)}
                      </pre>
                    )}

                    <div className="flex gap-2 mt-3">
                      {a.suggested_action === 'skip' && (
                        <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Skip Row</button>
                      )}
                      {a.suggested_action === 'modify' && (
                        <>
                          <button onClick={() => resolveAnomaly(a.id, 'accept', a.suggested_value)} className="px-3 py-1.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors">Accept Fix</button>
                          <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-3 py-1.5 text-xs font-semibold bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">Skip Row</button>
                        </>
                      )}
                      {(a.suggested_action === 'keep' || a.suggested_action === 'reclassify') && (
                        <button onClick={() => resolveAnomaly(a.id, 'accept')} className="px-3 py-1.5 text-xs font-semibold bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                          {a.suggested_action === 'reclassify' ? 'Reclassify as Settlement' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
