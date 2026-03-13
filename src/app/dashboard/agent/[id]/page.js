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
import { useGuestMode } from "../../../../lib/guest/GuestModeContext";
import GuestBanner from "../../components/GuestBanner";
import UpgradeAccountModal from "../../components/UpgradeAccountModal";
import VoiceSession from "../../../components/VoiceAgents/VoiceSession";

const getAccentTheme = (industry = "") => {
  const normalized = String(industry).toLowerCase();

  if (normalized.includes("health")) {
    return {
      chip: "dialora-chip-emerald",
      iconWrap: "bg-emerald-500/12 border border-emerald-400/20",
      iconColor: "text-emerald-300",
      panelBorder: "border-emerald-400/20",
    };
  }

  if (normalized.includes("retail") || normalized.includes("travel")) {
    return {
      chip: "dialora-chip-cyan",
      iconWrap: "bg-cyan-500/12 border border-cyan-400/20",
      iconColor: "text-cyan-300",
      panelBorder: "border-cyan-400/20",
    };
  }

  if (normalized.includes("beauty") || normalized.includes("aesthetic")) {
    return {
      chip: "dialora-chip-pink",
      iconWrap: "bg-pink-500/12 border border-pink-400/20",
      iconColor: "text-pink-300",
      panelBorder: "border-pink-400/20",
    };
  }

  if (normalized.includes("finance") || normalized.includes("bank")) {
    return {
      chip: "dialora-chip-amber",
      iconWrap: "bg-amber-500/12 border border-amber-400/20",
      iconColor: "text-amber-300",
      panelBorder: "border-amber-400/20",
    };
  }

  if (normalized.includes("real") || normalized.includes("property")) {
    return {
      chip: "dialora-chip-blue",
      iconWrap: "bg-sky-500/12 border border-sky-400/20",
      iconColor: "text-sky-300",
      panelBorder: "border-sky-400/20",
    };
  }

  return {
    chip: "dialora-chip-violet",
    iconWrap: "bg-violet-500/12 border border-violet-400/20",
    iconColor: "text-violet-300",
    panelBorder: "border-violet-400/20",
  };
};

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

const isValidCapturedValue = (value) =>
  value !== undefined &&
  value !== null &&
  (typeof value !== "string" || value.trim() !== "");

const mergeCapturedData = (previousData, incomingData) => {
  const updatedData = { ...previousData };
  Object.entries(incomingData || {}).forEach(([key, value]) => {
    if (isValidCapturedValue(value)) {
      updatedData[key] = value;
    } else {
      delete updatedData[key];
    }
  });
  return updatedData;
};

export default function LaunchAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const { isGuest } = useGuestMode();

  const [user, setUser] = useState(null);
  const [agent, setAgent] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [capturedData, setCapturedData] = useState({});
  const [conversationLog, setConversationLog] = useState([]);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  const voiceSessionRef = useRef(null);


  useEffect(() => {
    const checkAuthAndLoadAgent = async () => {
      if (!agentId) {
        setIsLoading(false);
        router.push("/dashboard");
        return;
      }

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
          if (!session?.access_token) throw new Error("No session");
          const response = await fetch(`/api/agents/${agentId}/custom-fields`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
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
    setCapturedData((prev) => mergeCapturedData(prev, data));
  }, []);

  const visibleCapturedEntries = Object.entries(capturedData).filter(
    ([, value]) => isValidCapturedValue(value),
  );

  const getFieldValue = useCallback(
    (fieldName) => {
      const matchedKey = Object.keys(capturedData).find(
        (key) => key.toLowerCase() === fieldName.toLowerCase(),
      );
      return matchedKey ? capturedData[matchedKey] : undefined;
    },
    [capturedData],
  );

  const bantEnabled = Boolean(agent?.collect_bant_info);
  const requireCustomerInfo = Boolean(agent?.require_customer_info);

  let baseRequiredFields = [];
  if (bantEnabled) {
    baseRequiredFields = [
      "contact_name",
      "email",
      "phone",
      "budget",
      "authority",
      "need",
      "timeline",
      "schedule_meeting_at",
    ];
  } else if (requireCustomerInfo) {
    baseRequiredFields = ["contact_name", "email", "phone"];
  }

  const requiredCustomFields = (customFields || [])
    .filter((field) => field?.is_required && field?.field_name)
    .map((field) => String(field.field_name).trim())
    .filter((fieldName) => fieldName.length > 0);

  const requiredFields = Array.from(
    new Set([...baseRequiredFields, ...requiredCustomFields]),
  );

  const hasAllRequiredFields = requiredFields.every((fieldName) =>
    isValidCapturedValue(getFieldValue(fieldName)),
  );

  const isLeadSubmitted =
    capturedData.crm_sync === "Synced to Database ✅" ||
    capturedData.crm_sync === "Synced to Google Sheets ✅";

  const accent = getAccentTheme(agent?.industry);

  const handleSubmitRequirements = useCallback(async () => {
    if (!agentId || isSubmittingLead) {
      return;
    }

    setIsSubmittingLead(true);
    setCapturedData((prev) =>
      mergeCapturedData(prev, { crm_sync: "In Progress..." }),
    );

    try {
      const leadName = getFieldValue("contact_name") || "Anonymous";
      const email = getFieldValue("email") || "";
      const phone = getFieldValue("phone") || "";
      const contactInfo =
        getFieldValue("contact_info") ||
        (email && phone
          ? `${email} | ${phone}`
          : email || phone || "No contact info provided");

      const standardKeys = new Set([
        "contact_name",
        "email",
        "phone",
        "lead_name",
        "contact_info",
        "lead_score",
        "budget",
        "authority",
        "need",
        "timeline",
        "schedule_meeting_at",
        "crm_sync",
        "crm_lead_name",
        "follow_up",
        "preferences",
        "last_search",
        "search_status",
      ]);

      const customFieldsPayload = Object.entries(capturedData).reduce(
        (acc, [key, value]) => {
          if (!standardKeys.has(key) && isValidCapturedValue(value)) {
            acc[key] = value;
          }
          return acc;
        },
        {},
      );

      const leadPayload = {
        lead_name: leadName,
        email,
        phone,
        contact_info: contactInfo,
        lead_score: getFieldValue("lead_score") || null,
        budget: getFieldValue("budget") || null,
        authority: getFieldValue("authority") || null,
        need: getFieldValue("need") || null,
        timeline: getFieldValue("timeline") || null,
        schedule_meeting_at: getFieldValue("schedule_meeting_at") || null,
        custom_fields: customFieldsPayload,
      };

      const session = await authService.getSession();
      if (!session?.access_token) {
        throw new Error("User session is not available");
      }

      const response = await fetch(`/api/agents/${agentId}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(leadPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to store lead details");
      }

      setCapturedData((prev) =>
        mergeCapturedData(prev, {
          crm_sync: "Synced to Database ✅",
          crm_lead_name: leadName,
          contact_info: contactInfo,
        }),
      );
    } catch (error) {
      setCapturedData((prev) =>
        mergeCapturedData(prev, {
          crm_sync: `Lead sync failed ❌ (${error?.message || "Unknown error"})`,
        }),
      );
    } finally {
      setIsSubmittingLead(false);
    }
  }, [
    agentId,
    capturedData,
    getFieldValue,
    isSubmittingLead,
  ]);

  const handleEndSession = async () => {
    if (voiceSessionRef.current) {
      // Note: VoiceSession will handle cleanup
    }

    // Save conversation
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
      {isGuest && (
        <GuestBanner onSignUp={() => setShowMigrateModal(true)} />
      )}

      <div
        className={`dialora-hero-panel rounded-2xl p-5 md:p-6 ${accent.panelBorder}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="dialora-secondary-btn p-2.5 rounded-full min-w-0"
            >
              <ChevronLeft size={18} className="text-slate-500" />
            </Link>
            <div className="leading-tight">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`dialora-chip ${accent.chip}`}>
                  {agent.industry}
                </span>
                <span className="dialora-chip">
                  {getLanguageName(agent.language)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {agent.name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Live launch console for voice interactions, lead capture, and
                knowledge-assisted responses.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="dialora-panel rounded-2xl px-4 py-3 min-w-[180px]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Session
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isSessionActive ? "bg-emerald-400" : "bg-rose-400"}`}
                />
                <span className="font-semibold text-slate-900">
                  {isSessionActive ? "Call in progress" : "Ready to connect"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section
            className={`dialora-panel dialora-glow-card rounded-2xl p-4 md:p-5 ${accent.panelBorder}`}
          >
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Launch console
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Talk to your agent live
                </h2>
              </div>
              <div
                className={`dialora-chip ${isSessionActive ? "dialora-chip-emerald" : accent.chip}`}
              >
                {isSessionActive ? "Listening" : "Standby"}
              </div>
            </div>
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
              onLogToCrm={null}
              onKnowledgeSearch={null}
            />
          </section>

          <section className="dialora-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Captured Data
              </h2>
              <ArrowUpDown size={16} className="text-slate-400" />
            </div>

            {visibleCapturedEntries.length > 0 ? (
              <div className="space-y-3">
                <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3">
                  {visibleCapturedEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
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

                {hasAllRequiredFields && !isLeadSubmitted && (
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleSubmitRequirements}
                      disabled={isSubmittingLead}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 ${
                        isSubmittingLead
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-950/40"
                      }`}
                    >
                      {isSubmittingLead
                        ? "Submitting..."
                        : "✓ Submit Requirements"}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">
                      Submit captured details to store this lead.
                    </p>
                  </div>
                )}
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
          <section
            className={`dialora-panel rounded-2xl p-5 ${accent.panelBorder}`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Agent Info
            </h2>

            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${accent.iconWrap}`}>
                  <UserRound size={18} className={accent.iconColor} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Voice Persona</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {agent.voice_persona}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${accent.iconWrap}`}>
                  <Building2 size={18} className={accent.iconColor} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Industry</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {agent.industry}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${accent.iconWrap}`}>
                  <Languages size={18} className={accent.iconColor} />
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

          <section
            className={`dialora-panel rounded-2xl p-5 ${isSessionActive ? "border-emerald-400/20" : "border-rose-400/20"}`}
          >
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
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors dialora-pill"
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

          <section
            className={`dialora-panel rounded-2xl p-5 ${accent.panelBorder}`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Agent Knowledge Base
            </h2>

            {knowledgeDocuments.length > 0 ? (
              <div className="space-y-2">
                {knowledgeDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${accent.iconWrap}`}>
                        <FileText
                          size={16}
                          className={`${accent.iconColor} shrink-0`}
                        />
                      </div>
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

      <UpgradeAccountModal
        isOpen={showMigrateModal}
        onClose={() => setShowMigrateModal(false)}
      />
    </div>
  );
}
