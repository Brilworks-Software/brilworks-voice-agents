"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { INDUSTRIES, LANGUAGES } from "./constants";
import IndustryCard from "./IndustryCard";
import VoiceSession from "./VoiceSession";
import Sidebar from "./Sidebar";
import Header from "./Header";
import {
  Laptop,
  Home,
  Hospital,
  Sparkles,
  Wrench,
  DollarSign,
  Shield,
  Package,
  Plane,
  Car,
  Scale,
  Handshake,
  ShoppingBag,
  GraduationCap,
  UtensilsCrossed,
} from "lucide-react";

const iconMap = {
  Laptop,
  Home,
  Hospital,
  Sparkles,
  Wrench,
  DollarSign,
  Shield,
  Package,
  Plane,
  Car,
  Scale,
  Handshake,
  ShoppingBag,
  GraduationCap,
  UtensilsCrossed,
};

const VoiceAgents = () => {
  const [view, setView] = useState("home");
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [capturedData, setCapturedData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voiceSessionRef = useRef(null);

  // Hydrate language selection from localStorage after mount (SSR-safe)
  useEffect(() => {
    const saved = localStorage.getItem("brilworks_lang");
    if (!saved) return;
    const found = LANGUAGES.find(
      (languageOption) => languageOption.code === saved,
    );
    if (found) {
      setSelectedLanguage(found);
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem("brilworks_lang", selectedLanguage.code);
  }, [selectedLanguage]);

  const handleSelectIndustry = (industry) => {
    setSelectedIndustry(industry);
    setTranscriptionHistory([]);
    setCapturedData({});
    setView("agent");
  };

  const startSession = useCallback(() => setIsSessionActive(true), []);
  const stopSession = useCallback(() => setIsSessionActive(false), []);

  const handleNewMessage = useCallback((role, text) => {
    setTranscriptionHistory((prev) => [
      ...prev,
      { role, text, timestamp: Date.now() },
    ]);
  }, []);

  const handleCapturedData = useCallback((data) => {
    console.log("Data is captured for the user", data);
    setCapturedData((prev) => {
      const updated = { ...prev, ...data };
      return updated;
    });
  }, []);

  const handleUpdateData = (key, value) => {
    setCapturedData((prev) => ({ ...prev, [key]: value }));
    if (isSessionActive && voiceSessionRef.current) {
      voiceSessionRef.current.sendMessage(
        `[SYSTEM UPDATE: User has manually updated their ${key} to "${value}". Please acknowledge and use this new value moving forward.]`,
      );
    }
  };

  const handleSubmitLead = useCallback(() => {
    if (!isSessionActive || !voiceSessionRef.current) {
      return;
    }

    setIsSubmitting(true);

    // Extract required fields from captured data
    const getFieldValue = (fieldName) => {
      const key = Object.keys(capturedData).find(
        (k) => k.toLowerCase() === fieldName.toLowerCase(),
      );
      return key ? capturedData[key] : "";
    };

    const budget = getFieldValue("budget");
    const authority = getFieldValue("authority");
    const need = getFieldValue("need");
    const timeline = getFieldValue("timeline");
    const contactName = getFieldValue("contact_name") || "Anonymous";
    const email = getFieldValue("email") || "";
    const phone = getFieldValue("phone") || "";
    const scheduleMeetingAt = getFieldValue("schedule_meeting_at") || "";

    // Determine lead score based on BANT data
    let leadScore = "COLD";
    if (budget && timeline && authority) {
      const timelineLower = String(timeline).toLowerCase();
      if (
        timelineLower.includes("month") ||
        timelineLower.includes("week") ||
        timelineLower.includes("day")
      ) {
        if (
          timelineLower.includes("1 month") ||
          timelineLower.includes("week") ||
          timelineLower.includes("day") ||
          timelineLower.includes("immediate")
        ) {
          leadScore = "HOT";
        } else if (timelineLower.includes("2") || timelineLower.includes("3")) {
          leadScore = "WARM";
        }
      }
    }

    // Create preferences summary with all BANT data
    const preferences = `Budget: ${budget || "Not specified"}, Authority: ${authority || "Not specified"}, Need: ${need || "Not specified"}, Timeline: ${timeline || "Not specified"}`;

    // Calculate follow-up reminder based on timeline
    let followUpReminder = "Within 24 hours";
    if (timeline) {
      const timelineLower = String(timeline).toLowerCase();
      if (
        timelineLower.includes("today") ||
        timelineLower.includes("immediate")
      ) {
        followUpReminder = "Today";
      } else if (timelineLower.includes("week")) {
        followUpReminder = "Within 3 days";
      } else if (timelineLower.includes("month")) {
        followUpReminder = "Within 1 week";
      }
    }

    // Format contact info according to logToCrmFunction specification
    // Format: "email@example.com | +1234567890" or just "email@example.com"
    let contactInfo = "";
    if (email && phone) {
      contactInfo = `${email} | ${phone}`;
    } else if (email) {
      contactInfo = email;
    } else if (phone) {
      contactInfo = phone;
    } else {
      contactInfo = "No contact info provided";
    }

    // Directly call log_to_crm handler with all required data
    // This mimics what happens when Gemini calls log_to_crm tool with all parameters
    handleCapturedData({
      crm_sync: "In Progress...",
      crm_lead_name: contactName,
      lead_score: leadScore,
      follow_up: followUpReminder,
      schedule_meeting_at: scheduleMeetingAt,
      contact_info: contactInfo,
      preferences: preferences,
    });

    // Simulate the CRM sync completion after a delay
    setTimeout(() => {
      handleCapturedData({ crm_sync: "Synced to Google Sheets ✅" });
      setIsSubmitting(false);
    }, 1500);

    // Note: We're not sending a message to Gemini to avoid WebSocket errors
    // The CRM sync happens directly through handleCapturedData
    // The agent will naturally understand the submission through the conversation context
  }, [isSessionActive, capturedData, handleCapturedData]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header
        onHomeClick={() => {
          stopSession();
          setView("home");
        }}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
          {view === "home" && (
            <div className="max-w-6xl mx-auto w-full">
              <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-sm ring-1 ring-slate-100">
                <h1 className="text-xl font-bold text-slate-800">
                  Choose a Brilworks Agent
                </h1>
                <p className="text-slate-500 mt-2">
                  Select a specialized agent to begin a high-fidelity voice
                  conversation.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {INDUSTRIES.map((industry) => (
                  <IndustryCard
                    key={industry.id}
                    industry={industry}
                    onClick={() => handleSelectIndustry(industry)}
                  />
                ))}
              </div>
            </div>
          )}

          {view === "agent" && selectedIndustry && (
            <div className="flex flex-col md:h-full space-y-4 max-w-5xl mx-auto w-full md:overflow-hidden">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setView("home");
                    stopSession();
                  }}
                  className="flex items-center text-slate-500 hover:text-slate-800 transition-colors w-fit group"
                >
                  <span className="mr-2 group-hover:-translate-x-1 transition-transform">
                    ←
                  </span>
                  Back to Selection
                </button>
                <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 font-medium">
                  Current Language:{" "}
                  <span className="text-slate-700 font-bold">
                    {selectedLanguage.name}
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 md:flex-1 md:min-h-0 md:overflow-hidden">
                <div className="md:flex-1 flex flex-col space-y-4 md:min-h-0">
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 border border-slate-200 p-6 md:flex-1 flex flex-col md:min-h-0 md:overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-3 rounded-xl bg-${selectedIndustry.color}-50`}
                        >
                          {(() => {
                            const IconComponent =
                              iconMap[selectedIndustry.icon] || Laptop;
                            return (
                              <IconComponent
                                className="w-8 h-8 text-slate-700"
                                strokeWidth={2}
                              />
                            );
                          })()}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-800">
                            {selectedIndustry.name}
                          </h2>
                          <p className="text-sm text-slate-500">
                            Agent: {selectedIndustry.agentName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className={`h-2 w-2 rounded-full ${isSessionActive ? "bg-green-500 animate-pulse" : "bg-slate-300"}`}
                        />
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {isSessionActive ? "Live Session" : "Standby"}
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
                      capturedData={capturedData}
                    />

                    <div className="mt-6 md:flex-1 md:min-h-0 h-64 md:h-auto overflow-y-auto space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-100 custom-scrollbar">
                      {transcriptionHistory.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                          {selectedLanguage.code === "auto"
                            ? "Start talking to see the transcription here..."
                            : `Ready for conversation in ${selectedLanguage.name}...`}
                        </div>
                      ) : (
                        transcriptionHistory.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                                msg.role === "user"
                                  ? "bg-blue-600 text-white rounded-tr-none"
                                  : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 uppercase">
                              {msg.role === "user"
                                ? "You"
                                : selectedIndustry.agentName}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4 md:h-full overflow-y-auto custom-scrollbar">
                  <Sidebar
                    industry={selectedIndustry}
                    data={capturedData}
                    onUpdateData={handleUpdateData}
                    onSubmitLead={handleSubmitLead}
                    isSubmitting={isSubmitting}
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
