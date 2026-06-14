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

  const downloadReport = () => {
    let content = `Import Report\nDate: ${new Date().toLocaleString()}\n`;
    content += `File: ${file?.name || 'unknown.csv'}\n`;
    content += `Total Rows Processed: ${result?.total_rows || 0}\n\n`;
    content += `--- Anomalies Detected & Actions Taken ---\n\n`;
    
    if (anomalies.length === 0) {
      content += `No anomalies detected during this import.\n`;
    } else {
      anomalies.forEach(a => {
        content += `Row ${a.row_number}: ${a.anomaly_type.replace(/_/g, ' ').toUpperCase()}\n`;
        content += `Description: ${a.description}\n`;
        content += `Suggested Action: ${a.suggested_action} (Value: ${JSON.stringify(a.suggested_value) || 'None'})\n`;
        content += `User Action Taken: ${a.user_action || 'Pending'} (Value: ${JSON.stringify(a.user_value) || 'None'})\n`;
        content += `Status: ${a.resolved ? 'RESOLVED' : 'UNRESOLVED'}\n`;
        content += `--------------------------------------------------\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_report_${sessionId || 'new'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      <button onClick={() => navigate(`/groups/${id}`)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        ← Back to Group
      </button>

      <h1 className="text-3xl font-extrabold text-slate-900">Import CSV</h1>
      <p className="font-medium text-slate-500 mt-2 mb-8">Drop your spreadsheet export here. We'll automatically catch data issues.</p>

      {!result ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-2xl shadow-sm">
          <div
            className={`border-2 border-dashed rounded-xl p-14 text-center transition-all cursor-pointer hover:bg-slate-50 ${
              file ? 'border-slate-800 bg-slate-50' : 'border-slate-300 hover:border-slate-400'
            }`}
            onClick={() => document.getElementById('csv-input').click()}
          >
            <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center text-3xl shadow-sm mb-4 ${
              file ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200'
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
              className="px-6 py-3 font-bold text-white bg-slate-900 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:bg-slate-800 transition-all">
              {uploading ? 'Analyzing...' : 'Analyze Data'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-w-4xl">
          {/* Report header */}
          <div className="px-6 py-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Analysis Report</h2>
              <p className="font-medium text-slate-500 mt-0.5 text-sm">
                {result.total_rows} rows processed · {result.anomaly_count} issues found
              </p>
            </div>
            <button onClick={confirmImport} disabled={unresolvedErrors.length > 0 || uploading}
              className="px-6 py-2.5 font-bold text-white bg-slate-900 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:bg-slate-800 transition-all">
              {unresolvedErrors.length > 0 ? `Fix ${unresolvedErrors.length} error(s) first` : uploading ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>

          {/* Severity tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            {['error', 'warning', 'info', 'report'].map(sev => {
              const count = sev === 'report' ? 0 : anomalies.filter(a => a.severity === sev && !a.resolved).length;
              return (
                <button key={sev} onClick={() => setActiveTab(sev)}
                  className={`flex-1 py-3 text-sm font-bold capitalize transition-all relative ${
                    activeTab === sev ? 'text-slate-900 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}>
                  {sev}
                  {count > 0 && <span className={`ml-2 text-[10px] ${sevStyles[sev].bg} ${sevStyles[sev].text} px-2 py-0.5 rounded border ${sevStyles[sev].border}`}>{count}</span>}
                  {activeTab === sev && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Anomaly list */}
          <div className="p-6 bg-white max-h-[600px] overflow-y-auto">
            {activeTab === 'report' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-extrabold text-slate-900">Complete Import Log</h3>
                  <button onClick={downloadReport} className="px-4 py-2 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-sm shadow-sm">
                    Download Text Report
                  </button>
                </div>
                {anomalies.length === 0 ? (
                  <p className="text-slate-500 font-medium text-sm py-4">No anomalies detected.</p>
                ) : (
                  <div className="space-y-3">
                    {anomalies.map(a => (
                      <div key={a.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm flex gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 mb-1">Row {a.row_number}: {a.anomaly_type.replace(/_/g, ' ').toUpperCase()}</p>
                          <p className="text-slate-600 mb-2">{a.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs font-medium bg-white p-3 rounded border border-slate-100 shadow-sm">
                            <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px]">Suggested Action</span> <span className="text-slate-800">{a.suggested_action}</span></div>
                            <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px]">User Action Taken</span> <span className="text-slate-800">{a.user_action || 'Pending'}</span></div>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center">
                           <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${a.resolved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                             {a.resolved ? 'Resolved' : 'Pending'}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : filtered.length === 0 ? (
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
                      className="flex gap-4 p-5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all"
                      style={{ animation: `slide-up 0.3s ease-out ${i * 40}ms both` }}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-extrabold shrink-0 ${sty.bg} ${sty.text} ${sty.border} border`}>
                        {sty.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                          {a.anomaly_type.replace(/_/g, ' ')}
                        </p>
                        <p className="font-bold text-slate-800 leading-snug">{a.description}</p>

                        {a.original_data && (
                          <pre className="mt-3 bg-slate-50 p-4 rounded-lg text-xs text-slate-700 font-mono overflow-x-auto border border-slate-200">
                            {JSON.stringify(a.original_data, null, 2)}
                          </pre>
                        )}

                        <div className="flex flex-wrap gap-2.5 mt-4">
                          {a.suggested_action === 'skip' && (
                            <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-4 py-2 text-xs font-bold bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 transition-colors shadow-sm">Skip Row</button>
                          )}
                          {a.suggested_action === 'modify' && (
                            <>
                              <button onClick={() => resolveAnomaly(a.id, 'accept', a.suggested_value)} className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-800 transition-all">Accept Fix</button>
                              <button onClick={() => resolveAnomaly(a.id, 'reject')} className="px-4 py-2 text-xs font-bold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">Skip Row</button>
                            </>
                          )}
                          {(a.suggested_action === 'keep' || a.suggested_action === 'reclassify') && (
                            <button onClick={() => resolveAnomaly(a.id, 'accept')} className="px-4 py-2 text-xs font-bold bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 shadow-sm transition-colors">
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
