"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { INDUSTRIES, LANGUAGES } from './constants';
import IndustryCard from './IndustryCard';
import VoiceSession from './VoiceSession';
import Sidebar from './Sidebar';
import Header from './Header';
import AdminConsole from './AdminConsole';

const VoiceAgents = () => {
  const [view, setView] = useState('home');
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brilworks_lang');
      if (saved) {
        const found = LANGUAGES.find(l => l.code === saved);
        if (found) return found;
      }
    }
    return LANGUAGES[0]; // Auto-detect
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [capturedData, setCapturedData] = useState({});
  const [leads, setLeads] = useState([]);
  
  const voiceSessionRef = useRef(null);

  // Persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brilworks_lang', selectedLanguage.code);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLeads = localStorage.getItem('brilworks_leads');
      if (savedLeads) {
        try {
          setLeads(JSON.parse(savedLeads));
        } catch (e) {
          console.error("Failed to load leads", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brilworks_leads', JSON.stringify(leads));
    }
  }, [leads]);

  const handleSelectIndustry = (industry) => {
    setSelectedIndustry(industry);
    setTranscriptionHistory([]);
    setCapturedData({});
    setView('agent');
  };

  const startSession = useCallback(() => setIsSessionActive(true), []);
  const stopSession = useCallback(() => setIsSessionActive(false), []);

  const handleNewMessage = useCallback((role, text) => {
    setTranscriptionHistory(prev => [
      ...prev,
      { role, text, timestamp: Date.now() }
    ]);
  }, []);

  const handleCapturedData = useCallback((data) => {
    setCapturedData(prev => {
      const updated = { ...prev, ...data };
      
      if (data.crm_sync === 'Synced to Google Sheets ✅' && selectedIndustry) {
        const newLead = {
          id: Math.random().toString(36).substr(2, 9),
          industry: selectedIndustry.id,
          timestamp: Date.now(),
          name: data.crm_lead_name || 'Anonymous',
          score: data.lead_score || 'N/A',
          details: { ...prev, ...data },
          followUp: data.follow_up || 'None'
        };
        setLeads(prevLeads => [newLead, ...prevLeads]);
      }
      
      return updated;
    });
  }, [selectedIndustry]);

  const handleUpdateData = (key, value) => {
    setCapturedData(prev => ({ ...prev, [key]: value }));
    if (isSessionActive && voiceSessionRef.current) {
      voiceSessionRef.current.sendMessage(`[SYSTEM UPDATE: User has manually updated their ${key} to "${value}". Please acknowledge and use this new value moving forward.]`);
    }
  };

  const clearLeads = () => {
    if (typeof window !== 'undefined' && window.confirm("Are you sure you want to clear all lead data?")) {
      setLeads([]);
      localStorage.removeItem('brilworks_leads');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header 
        onAdminClick={() => { stopSession(); setView('admin'); }} 
        onHomeClick={() => { stopSession(); setView('home'); }} 
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8">
          
          {view === 'admin' && (
            <AdminConsole leads={leads} onBack={() => setView('home')} onClear={clearLeads} />
          )}

          {view === 'home' && (
            <div className="max-w-6xl mx-auto w-full">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Choose a Brilworks Agent</h1>
                <p className="text-slate-500 mt-2">Select a specialized agent to begin a high-fidelity voice conversation.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {INDUSTRIES.map(industry => (
                  <IndustryCard 
                    key={industry.id} 
                    industry={industry} 
                    onClick={() => handleSelectIndustry(industry)} 
                  />
                ))}
              </div>
            </div>
          )}

          {view === 'agent' && selectedIndustry && (
            <div className="flex flex-col h-full space-y-4 max-w-5xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => { setView('home'); stopSession(); }}
                  className="flex items-center text-slate-500 hover:text-slate-800 transition-colors w-fit group"
                >
                  <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
                  Back to Selection
                </button>
                <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 font-medium">
                  Current Language: <span className="text-slate-700 font-bold">{selectedLanguage.name}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className={`text-4xl p-3 rounded-xl bg-${selectedIndustry.color}-50`}>
                          {selectedIndustry.icon}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-800">{selectedIndustry.name}</h2>
                          <p className="text-sm text-slate-500">Agent: {selectedIndustry.agentName}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {isSessionActive ? 'Live Session' : 'Standby'}
                        </span>
                      </div>
                    </div>

                    <VoiceSession 
                      ref={voiceSessionRef}
                      industry={selectedIndustry}
                      language={selectedLanguage}
                      isActive={isSessionActive}
                      onStart={startSession}
                      onStop={stopSession}
                      onMessage={handleNewMessage}
                      onDataCaptured={handleCapturedData}
                    />

                    <div className="mt-6 flex-1 overflow-y-auto min-h-0 space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-100 custom-scrollbar">
                      {transcriptionHistory.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                          {selectedLanguage.code === 'auto' ? 'Start talking to see the transcription here...' : `Ready for conversation in ${selectedLanguage.name}...`}
                        </div>
                      ) : (
                        transcriptionHistory.map((msg, i) => (
                          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                              msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                            }`}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 uppercase">
                              {msg.role === 'user' ? 'You' : selectedIndustry.agentName}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4 h-full overflow-y-auto custom-scrollbar">
                  <Sidebar 
                    industry={selectedIndustry} 
                    data={capturedData} 
                    onUpdateData={handleUpdateData}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default VoiceAgents;
