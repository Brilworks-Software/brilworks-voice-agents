"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  UserRound,
  Building2,
  Languages,
  ArrowUpDown,
  Info,
  FileText,
  ExternalLink,
} from "lucide-react";
import { authService } from "../../../../services/authService";
import { customAgentsService } from "../../../../services/customAgentsService";
import VoiceSession from "../../../components/VoiceAgents/VoiceSession";

// Helper function to map voice persona to Gemini voice names
const getVoiceForPersona = (persona) => {
  const voiceMap = {
    Professional: "Puck",
    Friendly: "Charon",
    "Sales Expert": "Kore",
    "Customer Support": "Fenrir",
    Consultant: "Aoede",
  };
  return voiceMap[persona] || "Puck";
};

// Helper function to get full language name from code
const getLanguageName = (code) => {
  const languageMap = {
    auto: "Auto-detect",
    "en-US": "English",
    "es-ES": "Spanish",
    "fr-FR": "French",
    "de-DE": "German",
    "it-IT": "Italian",
    "pt-BR": "Portuguese",
    "ru-RU": "Russian",
    "zh-CN": "Mandarin",
    "hi-IN": "Hindi",
    "ar-SA": "Arabic",
    "ja-JP": "Japanese",
    "gu-IN": "Gujarati",
  };
  return languageMap[code] || code;
};

export default function LaunchAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;

  const [user, setUser] = useState(null);
  const [agent, setAgent] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [capturedData, setCapturedData] = useState({});
  const [conversationLog, setConversationLog] = useState([]);

  const voiceSessionRef = useRef(null);

  useEffect(() => {
    const checkAuthAndLoadAgent = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }
        setUser(currentUser);

        const agentData = await customAgentsService.getAgentById(agentId);
        if (!agentData) {
          router.push("/dashboard");
          return;
        }
        setAgent(agentData);

        // Load custom fields
        try {
          const session = await authService.getSession();

          if (!session?.access_token) {
            throw new Error("User session is not available");
          }

          const response = await fetch(`/api/agents/${agentId}/custom-fields`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setCustomFields(data.customFields || []);
          }
        } catch (error) {
          console.error("Error loading custom fields:", error);
        }

        // Load knowledge documents
        try {
          const docs = await customAgentsService.getKnowledgeDocuments(agentId);
          setKnowledgeDocuments(docs);
        } catch (error) {
          console.error("Error loading knowledge documents:", error);
        }
      } catch (error) {
        console.error("Error loading agent:", error);
        router.push("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadAgent();
  }, [agentId, router]);

  // Memoize all callbacks passed to VoiceSession so their references stay stable
  // across re-renders (e.g. when customFields loads). Non-memoized callbacks would
  // cause stopLiveSession's useCallback[onStop] to get a new reference, which
  // previously triggered the unmount-cleanup effect mid-session, closing the WebSocket.
  const handleSessionStarted = useCallback(() => {
    setIsSessionActive(true);
  }, []);

  const handleSessionStopped = useCallback(() => {
    setIsSessionActive(false);
  }, []);

  const handleMessage = useCallback((message) => {
    setConversationLog((prev) => [...prev, message]);
  }, []);

  const handleDataCaptured = useCallback((data) => {
    setCapturedData((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  const handleEndSession = async () => {
    if (voiceSessionRef.current) {
      // Note: VoiceSession will handle cleanup
    }

    // Save conversation to database
    try {
      if (Object.keys(capturedData).length > 0 || conversationLog.length > 0) {
        await customAgentsService.saveConversation({
          agent_id: agentId,
          messages: conversationLog,
          lead_data: capturedData,
        });
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
    }

    router.push("/dashboard");
  };

  if (isLoading || !user || !agent) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-700">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-500" />
          </Link>
          <div className="leading-tight">
            <h1 className="text-xl md:text-xl font-bold text-slate-900">
              {agent.name}
            </h1>
            <p className="text-sm text-slate-500">
              {agent.industry} • {agent.language}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
            <VoiceSession
              ref={voiceSessionRef}
              industry={{
                id: agent.id,
                name: agent.industry,
                agentName: agent.name,
                systemInstruction: agent.system_prompt || "",
                usesCrmTools: agent.tools_enabled?.log_to_crm || false,
                isCustomAgent: true,
                collectBantInfo: agent.collect_bant_info || false,
                liveConnectConfig: {
                  model: "gemini-2.5-flash-native-audio-preview-12-2025",
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: getVoiceForPersona(agent.voice_persona),
                      },
                    },
                  },
                  outputAudioTranscription: {},
                  inputAudioTranscription: {},
                },
              }}
              language={{
                code: agent.language,
                name: getLanguageName(agent.language),
              }}
              isActive={isSessionActive}
              onStart={handleSessionStarted}
              onStop={handleSessionStopped}
              onMessage={handleMessage}
              onDataCaptured={handleDataCaptured}
              capturedData={capturedData}
              customFields={customFields}
              enableKnowledgeBase
            />
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Captured Data
              </h2>
              <ArrowUpDown size={16} className="text-slate-400" />
            </div>

            {Object.keys(capturedData).length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {Object.entries(capturedData).map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-slate-50 p-3 rounded-xl border border-slate-200"
                  >
                    <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">
                      {String(key).replaceAll("_", " ")}
                    </p>
                    <p className="text-base font-medium text-slate-900 break-words">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500">
                  No data captured yet. Start a conversation to collect lead
                  details.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Agent Info
            </h2>

            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <UserRound size={18} className="text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Voice Persona</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {agent.voice_persona}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Building2 size={18} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Industry</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {agent.industry}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-pink-50">
                  <Languages size={18} className="text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Language</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {agent.language}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  {!isSessionActive && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isSessionActive ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Session Status
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {isSessionActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              {isSessionActive ? (
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                >
                  End Session
                </button>
              ) : (
                <button
                  type="button"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <Info size={18} className="text-slate-500" />
                </button>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Agent Knowledge Base
            </h2>

            {knowledgeDocuments.length > 0 ? (
              <div className="space-y-2">
                {knowledgeDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText size={18} className="text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {doc.fileName}
                        </p>
                        {doc.createdAt && (
                          <p className="text-xs text-slate-500">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {doc.viewUrl && (
                      <a
                        href={doc.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-white transition-colors flex items-center gap-1 text-sm"
                      >
                        <span>Open</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500">
                  No knowledge documents uploaded for this agent.
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
