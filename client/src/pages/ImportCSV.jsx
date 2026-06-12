import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { UploadCloud, FileText, AlertTriangle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

const ImportCSV = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('critical'); // critical, error, warning, info

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/api/groups/${id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(data.stats);
      setAnomalies(data.anomalies);
      setSessionId(data.session_id);
    } catch (error) {
      console.error('Upload failed', error);
      alert(error.response?.data?.error || 'Failed to process CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (anomalyId, action, value = null) => {
    try {
      await api.put(`/api/groups/${id}/import/${sessionId}/anomalies/${anomalyId}`, {
        user_action: action,
        user_value: value
      });
      
      // Update local state to mark as resolved
      setAnomalies(anomalies.map(a => a.id === anomalyId ? { ...a, resolved: true, user_action: action } : a));
    } catch (error) {
      console.error('Failed to update anomaly', error);
    }
  };

  const handleConfirmImport = async () => {
    try {
      setLoading(true);
      await api.post(`/api/groups/${id}/import/${sessionId}/confirm`);
      navigate(`/groups/${id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm import');
      setLoading(false);
    }
  };

  const filteredAnomalies = anomalies.filter(a => a.severity === activeTab && !a.resolved);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-6 py-5 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => navigate(`/groups/${id}`)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center mb-3 group"
        >
          <ArrowLeft className="h-4 w-4 mr-1 transform group-hover:-translate-x-1 transition-transform" />
          Back to Group
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Import Expenses CSV</h1>
        <p className="text-slate-500 mt-1">Review and resolve data anomalies before finalizing the import.</p>
      </div>

      <div className="flex-1 p-6">
        {!importResult ? (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div 
              className={`mt-2 flex justify-center px-6 pt-10 pb-12 border-2 border-dashed rounded-xl ${file ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 transition-colors'}`}
            >
              <div className="space-y-2 text-center">
                <UploadCloud className={`mx-auto h-12 w-12 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                    <span>{file ? 'Change file' : 'Upload a file'}</span>
                    <input type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                  </label>
                  {!file && <p className="pl-1">or drag and drop</p>}
                </div>
                <p className="text-xs text-slate-500">
                  {file ? file.name : 'CSV files only up to 5MB'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white transition-colors ${
                  !file || loading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {loading ? 'Processing...' : 'Analyze CSV'}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Import Analysis Report</h2>
                  <p className="text-sm text-slate-500 mt-1">Processed {importResult.total_rows} rows. Found {importResult.anomaly_count} issues to review.</p>
                </div>
                <button
                  onClick={handleConfirmImport}
                  disabled={anomalies.some(a => (a.severity === 'error' || a.severity === 'critical') && !a.resolved)}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-sm disabled:bg-slate-300 transition-colors"
                >
                  Confirm Import
                </button>
              </div>

              <div className="flex border-b border-slate-200">
                {['critical', 'error', 'warning', 'info'].map(severity => {
                  const count = anomalies.filter(a => a.severity === severity && !a.resolved).length;
                  const colors = {
                    critical: 'text-red-700 border-red-500',
                    error: 'text-orange-700 border-orange-500',
                    warning: 'text-yellow-700 border-yellow-500',
                    info: 'text-blue-700 border-blue-500'
                  };
                  const bgColors = {
                    critical: 'bg-red-50',
                    error: 'bg-orange-50',
                    warning: 'bg-yellow-50',
                    info: 'bg-blue-50'
                  };
                  return (
                    <button
                      key={severity}
                      onClick={() => setActiveTab(severity)}
                      className={`flex-1 py-4 text-center font-medium text-sm border-b-2 transition-colors flex justify-center items-center gap-2 ${
                        activeTab === severity ? `${colors[severity]} ${bgColors[severity]}` : 'border-transparent text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="capitalize">{severity}</span>
                      {count > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-white shadow-sm border border-slate-200">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-0">
                <ul className="divide-y divide-slate-200">
                  {filteredAnomalies.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-3" />
                      No unresolved {activeTab}s remaining.
                    </div>
                  ) : (
                    filteredAnomalies.map((anomaly) => (
                      <li key={anomaly.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-6 items-start">
                        <div className="flex-shrink-0 mt-1">
                          {anomaly.severity === 'critical' ? <XCircle className="h-6 w-6 text-red-500" /> :
                           anomaly.severity === 'error' ? <AlertTriangle className="h-6 w-6 text-orange-500" /> :
                           anomaly.severity === 'warning' ? <AlertTriangle className="h-6 w-6 text-yellow-500" /> :
                           <AlertTriangle className="h-6 w-6 text-blue-500" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-slate-900 mb-1">{anomaly.anomaly_type.replace(/_/g, ' ').toUpperCase()}</h4>
                          <p className="text-sm text-slate-700 font-medium mb-3">{anomaly.description}</p>
                          
                          {anomaly.original_data && (
                            <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-600 mb-4 overflow-x-auto">
                              {JSON.stringify(anomaly.original_data)}
                            </div>
                          )}

                          <div className="flex gap-3">
                            {anomaly.suggested_action === 'skip' && (
                              <button onClick={() => handleAction(anomaly.id, 'reject')} className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200">
                                Skip Row
                              </button>
                            )}
                            {anomaly.suggested_action === 'modify' && (
                              <>
                                <button onClick={() => handleAction(anomaly.id, 'accept', anomaly.suggested_value)} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200">
                                  Accept Fix: {JSON.stringify(anomaly.suggested_value)}
                                </button>
                                <button onClick={() => handleAction(anomaly.id, 'reject')} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300">
                                  Reject & Skip Row
                                </button>
                              </>
                            )}
                            {(anomaly.suggested_action === 'keep' || anomaly.suggested_action === 'reclassify') && (
                              <button onClick={() => handleAction(anomaly.id, 'accept')} className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200">
                                Accept ({anomaly.suggested_action})
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportCSV;
