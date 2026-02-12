"use client";
import React from 'react';

const AdminConsole = ({ leads, onBack, onClear }) => {
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Console</h1>
          <p className="text-slate-500 mt-1">Review all captured leads and synchronization history from Google Sheets.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={onClear}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
          >
            Clear All Data
          </button>
          <button 
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
          >
            Back to App
          </button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-slate-800">No Leads Captured Yet</h2>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            Switch to an industry agent and start a conversation. Once a lead is logged via CRM, it will appear here.
          </p>
          <button 
            onClick={onBack}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            Start a Session
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-up</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                      {formatDate(lead.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{lead.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-[10px] font-black uppercase rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {lead.industry.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${
                        lead.score === 'HOT' ? 'bg-red-100 text-red-700' : 
                        lead.score === 'WARM' ? 'bg-orange-100 text-orange-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {lead.followUp}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(lead.details).slice(0, 3).map(([key, val]) => (
                          <span key={key} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                            {key}: {String(val).substring(0, 15)}...
                          </span>
                        ))}
                        {Object.keys(lead.details).length > 3 && (
                          <span className="text-[10px] text-slate-400">+{Object.keys(lead.details).length - 3} more</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Showing {leads.length} captured records
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-green-600 font-bold flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Live Brilworks Sync Active
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsole;
