"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { encode, decode, decodeAudioData } from "./services/audioUtils";
import { getBrilworksBase } from "./constants";
import { authService } from "@/services/authService";
import { authService } from "@/services/authService";

const VoiceSession = forwardRef(
  (
    {
      industry,
      language,
      isActive,
      onStart,
      onStop,
      onMessage,
      onDataCaptured,
      capturedData = {},
      // customFields is optional — existing 15 agents don't pass it and get default []
      customFields = [],
      enableKnowledgeBase = false,
      // customFields is optional — existing 15 agents don't pass it and get default []
      customFields = [],
      enableKnowledgeBase = false,
    },
    ref,
  ) => {
    console.log({
      industry,
      language,
      isActive,
      onStart,
      onStop,
      onMessage,
      onDataCaptured,
      capturedData,
      // customFields is optional — existing 15 agents don't pass it and get default []
      customFields,
      enableKnowledgeBase,
    });
    console.log({
      industry,
      language,
      isActive,
      onStart,
      onStop,
      onMessage,
      onDataCaptured,
      capturedData,
      // customFields is optional — existing 15 agents don't pass it and get default []
      customFields,
      enableKnowledgeBase,
    });
    const [isInitializing, setIsInitializing] = useState(false);
    const audioContextRef = useRef(null);
    const outputAudioContextRef = useRef(null);
    const sessionRef = useRef(null);
    const sessionPromiseRef = useRef(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set());
    const transcriptionRef = useRef({ user: "", model: "" });
    const inactivityTimeoutRef = useRef(null);
    const lastUserInteractionRef = useRef(Date.now());
    const streamRef = useRef(null);
    const scriptProcessorRef = useRef(null);
    const agentSpeakingRef = useRef(false);
    const pendingTimeoutRef = useRef(null);
    const isSessionActiveRef = useRef(false);
    const capturedDataRef = useRef(capturedData);
    const reconnectAttemptsRef = useRef(0);
    // Synchronous ref guards — prevent re-entry during render cycles triggered
    // by onStop(). React state (isInitializing) is async and cannot reliably
    // block re-entry within the same render pass.
    const isInitializingRef = useRef(false);
    const shouldStopRef = useRef(false);
    const sessionOpenedRef = useRef(false); // true once onopen actually fires for this session
    const MAX_RECONNECT_ATTEMPTS = 20;
    const lastStartAttemptRef = useRef(0);
    const MIN_SESSION_LIFETIME_MS = 500;

    // ─── Dynamic custom fields ────────────────────────────────────────────────
    // For the existing 15 voice agents customFields=[] so everything falls back
    // to the standard BANT base fields — no behaviour change for them.

    // bantEnabled: true for all non-custom agents (existing behaviour);
    // for custom agents it follows the collect_bant_info toggle.
    const bantEnabled =
      !industry.isCustomAgent || Boolean(industry.collectBantInfo);

    // requireCustomerInfo: determines if customer fields (contact_name, email, phone) should be collected
    const requireCustomerInfo =
      !industry.isCustomAgent || Boolean(industry.require_customer_info);

    const baseLeadFields = bantEnabled
      ? [
          "contact_name",
          "email",
          "phone",
          "budget",
          "authority",
          "need",
          "timeline",
          "schedule_meeting_at",
        ]
      : requireCustomerInfo
        ? ["contact_name", "email", "phone"]
        : [];

    const normalizedCustomFields = (customFields || [])
      .filter((field) => field?.field_name)
      .map((field) => ({
        name: String(field.field_name).trim(),
        description: field.field_description?.trim() || "",
        required: Boolean(field.is_required),
      }))
      .filter((field) => field.name.length > 0);

    const dynamicFieldNames = normalizedCustomFields.map((f) => f.name);
    const requiredDynamicFieldNames = normalizedCustomFields
      .filter((f) => f.required)
      .map((f) => f.name);

    const captureFieldNames = Array.from(
      new Set([...baseLeadFields, ...dynamicFieldNames]),
    );

    const requiredForCrmSubmission = Array.from(
      new Set([
        "lead_name",
        "contact_info",
        ...(bantEnabled
          ? ["budget", "authority", "need", "timeline", "schedule_meeting_at"]
          : []),
        ...requiredDynamicFieldNames,
      ]),
    );

    const dynamicLogProperties = normalizedCustomFields.reduce((acc, field) => {
      acc[field.name] = {
        type: Type.STRING,
        description: field.description
          ? `Custom field captured from the conversation: ${field.description}`
          : `Custom field captured from the conversation: ${field.name}`,
      };
      return acc;
    }, {});
    // ─────────────────────────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      sendMessage: (msg) => {
        console.log(msg);
        if (isSessionActiveRef.current && sessionRef.current) {
          try {
            sessionRef.current.sendRealtimeInput({
              media: {
                data: encode(new TextEncoder().encode(msg)),
                mimeType: "text/plain",
              },
            });
          } catch (err) {
            // If WebSocket is closing/closed, mark session as inactive
            if (
              err.message &&
              (err.message.includes("CLOSING") ||
                err.message.includes("CLOSED"))
            ) {
              console.warn("Cannot send message - WebSocket session is closed");
              isSessionActiveRef.current = false;
            } else {
              console.error("Error sending message:", err);
            }
          }
        } else {
          console.warn("Cannot send message - session is not active");
        }
      },
    }));

    // ─── Tool declarations ──────────────────────────────────────────────────
    // NOTE: Do NOT use 'enum' on any parameter — the Gemini Live native audio
    // API rejects function declarations that contain 'enum', closing the WebSocket
    // with code 1000 immediately after setup. Encode allowed values in the
    // description instead.
    const captureDataFunction = {
      name: "capture_information",
      parameters: {
        type: Type.OBJECT,
        description: `Capture specific user information identified during the conversation. Allowed field names: ${captureFieldNames.join(", ")}. Required custom fields: ${requiredDynamicFieldNames.length > 0 ? requiredDynamicFieldNames.join(", ") : "none"}. Call this IMMEDIATELY when user mentions any of these details.`,
        properties: {
          field_name: {
            type: Type.STRING,
            description: `The name of the attribute. Must be one of: ${captureFieldNames.join(", ")}.`,
          },
          value: {
            type: Type.STRING,
            description:
              "The value associated with the field. Capture exactly as the user states it.",
          },
        },
        required: ["field_name", "value"],
      },
    };

    console.log(captureDataFunction);

    const logToCrmFunction = {
      name: "log_to_crm",
      parameters: {
        type: Type.OBJECT,
        description: `Synchronize lead data with Brilworks CRM (Google Sheets) only after all required fields are available, including required custom fields: ${requiredDynamicFieldNames.length > 0 ? requiredDynamicFieldNames.join(", ") : "none"}. Determine lead_score: HOT (ready to buy, budget confirmed, timeline < 1 month, has authority), WARM (interested, has budget, timeline 1-3 months), or COLD (just browsing, no clear budget/timeline/authority).`,
        properties: {
          lead_name: {
            type: Type.STRING,
            description:
              'The lead\'s full name from "contact_name" field. Use "Anonymous" if not provided.',
          },
          contact_info: {
            type: Type.STRING,
            description:
              'Email and/or phone from captured "email" and "phone" fields. Format: "email@example.com | +1234567890" or just the available contact method.',
          },
          lead_score: {
            type: Type.STRING,
            description:
              'Lead qualification based on captured BANT data (Budget, Authority, Need, Timeline): "HOT", "WARM", or "COLD".',
          },
          ...(bantEnabled
            ? {
                budget: {
                  type: Type.STRING,
                  description:
                    'Budget amount from "budget" field captured earlier. REQUIRED for BANT qualification.',
                },
                authority: {
                  type: Type.STRING,
                  description:
                    'Decision-making authority from "authority" field captured earlier. REQUIRED for BANT qualification.',
                },
                need: {
                  type: Type.STRING,
                  description:
                    'Specific needs/requirements from "need" field captured earlier. REQUIRED for BANT qualification.',
                },
                timeline: {
                  type: Type.STRING,
                  description:
                    'Purchase timeline from "timeline" field captured earlier. REQUIRED for BANT qualification.',
                },
                schedule_meeting_at: {
                  type: Type.STRING,
                  description:
                    'Scheduled meeting date/time from "schedule_meeting_at" field. REQUIRED: Must be provided by the user.',
                },
              }
            : {}),
          // Dynamically injected custom fields (empty for existing 15 agents)
          ...dynamicLogProperties,
        },
        required: requiredForCrmSubmission,
      },
    };

    const searchPropertiesFunction = {
      name: "search_properties",
      parameters: {
        type: Type.OBJECT,
        description: "Search properties based on filters.",
        properties: {
          budget: { type: Type.STRING },
          bedrooms: { type: Type.STRING },
          location: { type: Type.STRING },
        },
        required: ["budget", "bedrooms", "location"],
      },
    };

    const searchKnowledgeBaseFunction = {
      name: "search_knowledge_base",
      parameters: {
        type: Type.OBJECT,
        description:
          "Search the agent knowledge base for factual answers from uploaded PDF documents.",
        properties: {
          query: {
            type: Type.STRING,
            description:
              "The user question or search phrase to look up in uploaded knowledge documents.",
          },
        },
        required: ["query"],
      },
    };

    const startLiveSession = async () => {
      try {
        // Synchronous ref guards — prevent re-entry during render cycles
        if (isInitializingRef.current || shouldStopRef.current) return;
        isInitializingRef.current = true;
        sessionOpenedRef.current = false;
        setIsInitializing(true);
        shouldStopRef.current = false;
        lastStartAttemptRef.current = Date.now();

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
        if (!apiKey) {
          console.error(
            "Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.",
          );
          isInitializingRef.current = false;
          setIsInitializing(false);
          onStop();
          return;
        }

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { apiVersion: "v1alpha" },
        });

        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )({ sampleRate: 16000 });
        outputAudioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )({ sampleRate: 24000 });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        // Combine standard Brilworks instructions with industry-specific rules and embedded memory
        const baseInstruction = getBrilworksBase(language.name);
        const industryRules = industry.systemInstruction;

        // Only include non-empty captured data to avoid policy violations
        const capturedDataForMemory = Object.entries(
          capturedDataRef.current || {},
        )
          .filter(
            ([key, value]) =>
              value && value !== "" && typeof value === "string",
          )
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

        const memoryText =
          Object.keys(capturedDataForMemory).length > 0
            ? Object.entries(capturedDataForMemory)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "None yet";

        const knowledgeToolEnabled =
          enableKnowledgeBase && industry.isCustomAgent && Boolean(industry.id);
        const knowledgeToolInstruction = knowledgeToolEnabled
          ? "\n\nKNOWLEDGE BASE INSTRUCTIONS:\n- You can call search_knowledge_base to retrieve facts from uploaded documents.\n- Call it whenever the user asks about product/service details, policies, pricing, process, or any factual info.\n- After receiving tool results, answer using those facts and keep the response concise."
          : "";
        const sessionGreetingInstruction =
          "\n\nSESSION START INSTRUCTION:\n- As soon as the session starts, immediately greet the user with a warm, professional opening message and introduce yourself before asking the first question.\n- In that first greeting, clearly state what this agent is and what kinds of tasks or questions it can help with.\n- Do not wait for the user to speak first.";

        // Determine if tools for lead qualification should be included
        const shouldIncludeQualificationTools =
          bantEnabled ||
          requireCustomerInfo ||
          normalizedCustomFields.length > 0;

        const leadQualificationGuidance = shouldIncludeQualificationTools
          ? "\n\nLEAD QUALIFICATION GUIDANCE:\n- My role is to let the user know I can answer their questions.\n- I will also ask for the details needed to qualify leads.\n- Keep responses concise, relevant, and focused on lead qualification outcomes."
          : "";

        // For custom agents: use the user's system prompt directly — no sub-prompts
        // added (no getBrilworksBase, no memory text, no extra instructions), except optional KB and qualification instructions.
        // For existing non-custom agents: keep the original behaviour.
        const fullSystemInstruction = industry.isCustomAgent
          ? `${industryRules} ${leadQualificationGuidance} ${knowledgeToolInstruction} ${sessionGreetingInstruction}`
          : shouldIncludeQualificationTools
            ? `${baseInstruction}\n\nCurrent lead data: ${memoryText}\n\n${leadQualificationGuidance}${industryRules}\n\nIMPORTANT INSTRUCTIONS:\n1. Use capture_information immediately whenever the user provides data.\n2. Allowed capture fields: ${captureFieldNames.join(", ")}.\n3. Required custom fields before CRM sync: ${requiredDynamicFieldNames.length > 0 ? requiredDynamicFieldNames.join(", ") : "none"}.\n4. If any required field is missing, ask for only the missing fields and do not call log_to_crm yet.${sessionGreetingInstruction}`
            : `${baseInstruction}\n\n${industryRules}${sessionGreetingInstruction}`;

        const functionDeclarations = [];
        if (shouldIncludeQualificationTools) {
          functionDeclarations.push(
            captureDataFunction,
            logToCrmFunction,
            searchPropertiesFunction,
          );
        }
        if (knowledgeToolEnabled) {
          functionDeclarations.push(searchKnowledgeBaseFunction);
        }

        console.log(functionDeclarations, fullSystemInstruction);
        // Use industry-specific liveConnectConfig if available, otherwise use default
        const liveConnectConfig = industry.liveConnectConfig || {
          model: "gemini-2.5-flash-native-audio-preview-12-2025",
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        };

        // ── Debug: log the full session config so we can spot API-rejection causes ──
        console.log("🟡 [VoiceSession] Starting live connect:", {
          model: liveConnectConfig.model,
          industryId: industry.id,
          industryName: industry.name,
          usesCrmTools: industry.usesCrmTools,
          customFieldsCount: (customFields || []).length,
          normalizedCustomFieldsCount: normalizedCustomFields.length,
          captureFieldNames,
          requiredForCrmSubmission,
          responseModalities: liveConnectConfig.responseModalities,
          speechConfig: liveConnectConfig.speechConfig,
          toolsIncluded: industry.usesCrmTools,
          captureDataFunctionDef: industry.usesCrmTools
            ? captureDataFunction
            : null,
        });

        const sessionPromise = ai.live.connect({
          model: liveConnectConfig.model,
          callbacks: {
            onopen: () => {
              // Do NOT clear isInitializingRef here.
              // onStart() triggers the parent to flip isActive which re-fires useEffect([isActive]).
              // At that point sessionRef.current is still null (await below hasn't resolved).
              // Keeping isInitializingRef=true blocks any re-entry until sessionRef is set.
              sessionOpenedRef.current = true;
              reconnectAttemptsRef.current = 0;

              const source =
                audioContextRef.current.createMediaStreamSource(stream);
              const scriptProcessor =
                audioContextRef.current.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = scriptProcessor;

              scriptProcessor.onaudioprocess = (e) => {
                // Don't process audio if session is not active
                if (!isSessionActiveRef.current || !sessionRef.current) {
                  return;
                }

                // Check WebSocket state - don't send if closing or closed
                // The session object might have an internal WebSocket that we need to check
                // For now, rely on isSessionActiveRef which is set to false in onclose

                if (audioContextRef.current?.state === "suspended") {
                  audioContextRef.current.resume();
                }
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) {
                  int16[i] = inputData[i] * 32768;
                }
                const pcmBlob = {
                  data: encode(new Uint8Array(int16.buffer)),
                  mimeType: "audio/pcm;rate=16000",
                };

                // Double-check session is still active and valid before sending
                if (isSessionActiveRef.current && sessionRef.current) {
                  try {
                    sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) {
                    // If WebSocket is closing/closed, mark session as inactive to stop further attempts
                    if (
                      err.message &&
                      (err.message.includes("CLOSING") ||
                        err.message.includes("CLOSED"))
                    ) {
                      console.warn(
                        "WebSocket session closed, stopping audio processing",
                      );
                      isSessionActiveRef.current = false;
                      // Optionally try to reconnect or notify user
                    }
                    // Silently ignore other errors - session may be closing
                  }
                }
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(audioContextRef.current.destination);

              // Mark session as active
              isSessionActiveRef.current = true;

              // Reset interaction tracking when session starts
              lastUserInteractionRef.current = Date.now();
              agentSpeakingRef.current = false;
              if (inactivityTimeoutRef.current) {
                clearTimeout(inactivityTimeoutRef.current);
              }
              inactivityTimeoutRef.current = null;
              if (pendingTimeoutRef.current) {
                clearTimeout(pendingTimeoutRef.current);
              }
              pendingTimeoutRef.current = null;

              // Note: We're not sending captured data automatically to prevent WebSocket errors
              // The captured data is maintained in state and the agent can reference it through the conversation
              // If needed, we can send it manually through the sendMessage method

              onStart();
              setIsInitializing(false);
            },
            onmessage: async (message) => {
              // Reset inactivity timeout when user speaks
              if (message.serverContent?.inputTranscription) {
                const text =
                  message.serverContent.inputTranscription.text || "";
                if (text) {
                  transcriptionRef.current.user += text;
                  lastUserInteractionRef.current = Date.now();
                  // Clear existing timeout and reset it
                  if (inactivityTimeoutRef.current) {
                    clearTimeout(inactivityTimeoutRef.current);
                    inactivityTimeoutRef.current = null;
                  }
                  if (pendingTimeoutRef.current) {
                    clearTimeout(pendingTimeoutRef.current);
                    pendingTimeoutRef.current = null;
                  }
                }
              }
              if (message.serverContent?.outputTranscription) {
                try {
                  const text =
                    message.serverContent.outputTranscription.text || "";
                  if (text) {
                    transcriptionRef.current.model += text;
                  }
                } catch (err) {
                  console.warn("Error processing output transcription:", err);
                  // Continue even if transcription processing fails
                }
              }
              if (message.serverContent?.turnComplete) {
                try {
                  const hadUserInput = !!transcriptionRef.current.user;

                  // Send user transcription if available
                  if (transcriptionRef.current.user) {
                    try {
                      onMessage("user", transcriptionRef.current.user);
                      lastUserInteractionRef.current = Date.now();
                      // Clear timeout since user just spoke
                      if (inactivityTimeoutRef.current) {
                        clearTimeout(inactivityTimeoutRef.current);
                        inactivityTimeoutRef.current = null;
                      }
                      if (pendingTimeoutRef.current) {
                        clearTimeout(pendingTimeoutRef.current);
                        pendingTimeoutRef.current = null;
                      }
                    } catch (err) {
                      console.warn("Error sending user message:", err);
                      // Continue even if sending fails
                    }
                  }

                  // Always send model transcription, even if it contains control characters
                  // This ensures the response doesn't get stuck
                  if (transcriptionRef.current.model) {
                    try {
                      onMessage("model", transcriptionRef.current.model);
                    } catch (err) {
                      console.warn("Error sending model message:", err);
                      // Continue even if sending fails - don't let this block the flow
                    }
                  }

                  // Always reset transcription buffer after turnComplete, regardless of errors
                  // This prevents the buffer from getting stuck with control characters
                  transcriptionRef.current = { user: "", model: "" };

                  // Don't start timeout immediately on turnComplete
                  // Wait for audio to finish playing (handled in audio onended callback)
                  // Only clear any pending timeout if user just spoke
                  if (hadUserInput) {
                    // User spoke, clear any pending timeouts
                    if (pendingTimeoutRef.current) {
                      clearTimeout(pendingTimeoutRef.current);
                      pendingTimeoutRef.current = null;
                    }
                  }
                } catch (err) {
                  console.error("Error in turnComplete handler:", err);
                  // Reset transcription buffer even on error to prevent getting stuck
                  transcriptionRef.current = { user: "", model: "" };
                }
              }

              const base64Audio =
                message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  ctx.currentTime,
                );
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  24000,
                  1,
                );
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;

                // Track that agent is speaking
                agentSpeakingRef.current = true;

                source.onended = () => {
                  sourcesRef.current.delete(source);
                  // Check if all audio sources have finished
                  if (sourcesRef.current.size === 0) {
                    // agentSpeakingRef.current = false;
                    // Agent finished speaking, continue listening - no timeout
                    // Session will continue until user explicitly disconnects
                  }
                };
                sourcesRef.current.add(source);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach((s) => {
                  try {
                    s.stop();
                  } catch (e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                agentSpeakingRef.current = false;
                // User interrupted, reset inactivity timeout
                lastUserInteractionRef.current = Date.now();
                if (inactivityTimeoutRef.current) {
                  clearTimeout(inactivityTimeoutRef.current);
                  inactivityTimeoutRef.current = null;
                }
                if (pendingTimeoutRef.current) {
                  clearTimeout(pendingTimeoutRef.current);
                  pendingTimeoutRef.current = null;
                }
              }

              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === "capture_information") {
                    const args = fc.args;
                    onDataCaptured({ [args.field_name]: args.value });
                  }
                  if (fc.name === "log_to_crm") {
                    const args = fc.args;
                    onDataCaptured({
                      crm_sync: "In Progress...",
                      crm_lead_name: args.lead_name,
                      lead_score: args.lead_score,
                      follow_up: args.follow_up_reminder,
                      schedule_meeting_at: args.schedule_meeting_at || "",
                      contact_info: args.contact_info || "",
                      preferences: args.preferences || "",
                    });
                    setTimeout(
                      () =>
                        onDataCaptured({
                          crm_sync: "Synced to Google Sheets ✅",
                        }),
                      1500,
                    );
                  }
                  if (fc.name === "search_properties") {
                    const args = fc.args;
                    onDataCaptured({
                      last_search: `${args.budget}, ${args.bedrooms}BR in ${args.location}`,
                      search_status: "Scanning Brilworks Database...",
                    });
                  }

                  let toolResult = "Action completed in Brilworks CRM.";
                  console.log("Tool result", toolResult);
                  if (fc.name === "search_knowledge_base") {
                    const query = fc.args?.query?.trim();
                    if (!query) {
                      toolResult = "Knowledge search query was empty.";
                    } else {
                      try {
                        const session = await authService.getSession();
                        if (!session?.access_token) {
                          throw new Error("User session is not available");
                        }

                        const response = await fetch(
                          `/api/agents/${industry.id}/knowledge/search`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({
                              query,
                              limit: 3,
                            }),
                          },
                        );

                        const result = await response.json();
                        if (!response.ok) {
                          throw new Error(
                            result?.error || "Knowledge search failed",
                          );
                        }

                        toolResult =
                          result?.contextText || "No matching knowledge found.";
                      } catch (error) {
                        toolResult = `Knowledge search failed: ${error?.message || "Unknown error"}`;
                      }
                    }
                  }

                  sessionPromise.then((s) =>
                    s.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: {
                          result: toolResult,
                        },
                      },
                    }),
                  );
                }
              }
            },
            onerror: (e) => {
              console.error("Session error:", e);
              if (e.code && e.code !== "NORMAL_CLOSURE") {
                stopLiveSession();
              }
            },
            onclose: (event) => {
              isSessionActiveRef.current = false;

              const sessionDuration = Date.now() - lastStartAttemptRef.current;
              const didOpen = sessionOpenedRef.current;
              sessionOpenedRef.current = false;

              console.log("🔴 WebSocket session closed:", {
                code: event.code,
                reason: event.reason || "No reason provided",
                wasClean: event.wasClean,
                duration: sessionDuration + "ms",
                didOpen,
              });

              // Only treat as a failed-init if onopen never fired.
              // If onopen fired the connection was real — fall through to normal handling.
              if (!didOpen && sessionDuration < MIN_SESSION_LIFETIME_MS) {
                console.error(
                  `⚠️ Session closed after only ${sessionDuration}ms without onopen firing. Connection failure. Stopping session.`,
                );
                if (scriptProcessorRef.current) {
                  try {
                    scriptProcessorRef.current.disconnect();
                  } catch (e) {}
                  scriptProcessorRef.current = null;
                }
                sessionRef.current = null;
                sessionPromiseRef.current = null;
                isInitializingRef.current = false;
                shouldStopRef.current = true;
                setIsInitializing(false);
                onStop();
                return;
              }

              if (event.code === 1006 || event.code === 1011) {
                console.warn(
                  "Session closed abnormally - possible timeout or network issue",
                );
              }

              // Reconnect on policy violation (1008)
              if (
                event.code === 1008 &&
                reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
              ) {
                reconnectAttemptsRef.current += 1;
                console.warn(
                  `WebSocket closed with policy violation (1008). Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
                );
                if (scriptProcessorRef.current) {
                  try {
                    scriptProcessorRef.current.disconnect();
                  } catch (e) {}
                  scriptProcessorRef.current = null;
                }
                sessionRef.current = null;
                sessionPromiseRef.current = null;
                if (audioContextRef.current) {
                  try {
                    audioContextRef.current.close();
                  } catch (e) {}
                  audioContextRef.current = null;
                }
                if (outputAudioContextRef.current) {
                  try {
                    outputAudioContextRef.current.close();
                  } catch (e) {}
                  outputAudioContextRef.current = null;
                }
                shouldStopRef.current = false;
                isInitializingRef.current = false;
                setTimeout(() => {
                  startLiveSession();
                }, 1500);
                return;
              }

              if (event.code === 1008) {
                console.error(
                  `WebSocket closed with policy violation (1008) after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts. Giving up.`,
                );
              }

              if (scriptProcessorRef.current) {
                try {
                  scriptProcessorRef.current.disconnect();
                } catch (e) {}
                scriptProcessorRef.current = null;
              }

              sessionRef.current = null;
              sessionPromiseRef.current = null;
              isInitializingRef.current = false;
              setIsInitializing(false);

              if (event.code === 1000 || event.code === 1001) {
                console.log(
                  `Session ended normally (code ${event.code}). Stopping to prevent restart loop.`,
                );
                shouldStopRef.current = true;
                onStop();
                return;
              }

              console.warn(
                `Session closed with error code ${event.code}. Stopping session.`,
              );
              shouldStopRef.current = true;
              onStop();
            },
          },
          config: {
            responseModalities: liveConnectConfig.responseModalities || [
              Modality.AUDIO,
            ],
            systemInstruction: fullSystemInstruction,
            speechConfig: liveConnectConfig.speechConfig || {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
            outputAudioTranscription:
              liveConnectConfig.outputAudioTranscription !== undefined
                ? liveConnectConfig.outputAudioTranscription
                : {},
            inputAudioTranscription:
              liveConnectConfig.inputAudioTranscription !== undefined
                ? liveConnectConfig.inputAudioTranscription
                : {},
            // Omit 'tools' entirely when not used — the Gemini native audio API rejects tools: []
            // and closes the connection with code 1000 after onopen.
            ...(functionDeclarations.length > 0
              ? {
                  tools: [
                    {
                      functionDeclarations,
                    },
                  ],
                }
              : {}),
          },
        });

        sessionPromiseRef.current = sessionPromise;
        sessionRef.current = await sessionPromise;
        // Safe to clear now — sessionRef.current is set, so useEffect re-entry will
        // see sessionRef.current != null and skip startLiveSession.
        isInitializingRef.current = false;
      } catch (err) {
        console.error("Failed to start session", err);
        isInitializingRef.current = false;
        setIsInitializing(false);
        onStop();
      }
    };

    // Stable ref so the unmount cleanup can call the latest stopLiveSession without
    // being a reactive dependency — avoids triggering cleanup on every parent re-render.
    const stopLiveSessionRef = useRef(null);

    const stopLiveSession = useCallback(() => {
      // Set guards synchronously before any async cleanup
      shouldStopRef.current = true;
      isInitializingRef.current = false;
      // Mark session as inactive first to prevent any pending audio callbacks from sending data
      isSessionActiveRef.current = false;

      // Clear inactivity timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      agentSpeakingRef.current = false;

      // Disconnect script processor
      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect();
        } catch (e) {}
        scriptProcessorRef.current = null;
      }

      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
        streamRef.current = null;
      }

      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch (e) {}
        sessionRef.current = null;
      }
      sessionPromiseRef.current = null;
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
        try {
          outputAudioContextRef.current.close();
        } catch (e) {}
        outputAudioContextRef.current = null;
      }
      setIsInitializing(false);
      onStop();
    }, [onStop]);

    // Keep the ref in sync with the latest callback instance.
    // This is safe to do inline (no effect needed) since refs are mutable.
    stopLiveSessionRef.current = stopLiveSession;

    // Handle starting/stopping based on the isActive prop
    // Use isInitializingRef (synchronous) not isInitializing (async React state).
    // Stale state can pass the guard during the render triggered by onStop().
    useEffect(() => {
      if (
        isActive &&
        !sessionRef.current &&
        !isInitializingRef.current &&
        !shouldStopRef.current
      ) {
        startLiveSession();
      } else if (!isActive && sessionRef.current) {
        stopLiveSession();
      }
    }, [isActive]); // Only react to the boolean toggle

    // ONLY cleanup when the component is actually destroyed (unmounted).
    // IMPORTANT: empty dep array [] so this effect does NOT re-run (and re-run cleanup)
    // whenever stopLiveSession changes reference due to a parent re-render.
    // Previously [stopLiveSession] caused the cleanup to fire mid-session whenever the
    // parent re-rendered with a new onStop callback reference (e.g. page.js loading
    // customFields), which silently closed a live session with code 1000.
    useEffect(() => {
      return () => {
        // This runs ONLY when the user navigates away or closes the tab
        if (sessionRef.current) {
          stopLiveSessionRef.current?.();
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update ref when capturedData changes
    useEffect(() => {
      capturedDataRef.current = capturedData;
    }, [capturedData]);

    // Hidden Context Injection: Sync captured data to model's working memory
    useEffect(() => {
      if (
        isSessionActiveRef.current &&
        sessionRef.current &&
        Object.keys(capturedData).length > 0
      ) {
        // Format the current memory state
        const memoryUpdate = Object.entries(capturedData)
          .filter(([k, v]) => v && v !== "" && typeof v === "string")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");

        if (memoryUpdate) {
          // Send as a hidden system-style update
          try {
            sessionRef.current.sendRealtimeInput([
              {
                text: `[SYSTEM UPDATE: Current Lead Memory updated to: ${memoryUpdate}]`,
              },
            ]);
            console.log("Memory synced to model context:", memoryUpdate);
          } catch (err) {
            console.error("Failed to sync memory:", err);
          }
        }
      }
    }, [capturedData]); // Runs whenever capturedData prop changes
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-2">
        <div className="relative">
          {isActive && (
            <div className="absolute inset-0 pulsate bg-blue-400 rounded-full blur-2xl opacity-20 -z-10" />
          )}
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
              isActive
                ? "bg-blue-600 shadow-xl shadow-blue-300 scale-110"
                : "bg-slate-100 hover:bg-slate-200 cursor-pointer border-2 border-slate-200"
            }`}
            onClick={
              isActive
                ? undefined
                : () => {
                    shouldStopRef.current = false; // reset guard on explicit user click
                    startLiveSession();
                  }
            }
          >
            {isInitializing ? (
              <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            ) : isActive ? (
              <div className="flex space-x-1 items-end h-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-white rounded-full animate-bounce"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: `${Math.random() * 100 + 50}%`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-4xl">🎙️</div>
            )}
          </div>
        </div>

        <div className="text-center px-4">
          <h4 className="font-bold text-slate-800">
            {isActive
              ? `${industry.agentName} is Listening...`
              : isInitializing
                ? "Establishing Secure Line..."
                : `Start Brilworks AI Voice Session`}
          </h4>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            {isActive
              ? `Language: ${language.name}. Syncing to Brilworks CRM.`
              : `Expert support in multiple languages with ${industry.agentName}`}
          </p>
        </div>

        {isActive && (
          <button
            onClick={stopLiveSession}
            className="px-8 py-3 bg-red-50 text-red-600 border border-red-200 rounded-full font-bold hover:bg-red-100 transition-colors shadow-sm"
          >
            Disconnect Call
          </button>
        )}
      </div>
    );
  },
);

VoiceSession.displayName = "VoiceSession";

export default VoiceSession;
