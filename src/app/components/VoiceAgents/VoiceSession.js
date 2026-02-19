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
    },
    ref,
  ) => {
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

    const captureDataFunction = {
      name: "capture_information",
      parameters: {
        type: Type.OBJECT,
        description:
          'Capture specific user information identified during the conversation. REQUIRED fields for lead qualification: "budget", "authority", "need", "timeline", "contact_name", "email", "schedule_meeting_at". Also capture "phone" and other relevant details when provided. Call this IMMEDIATELY when user mentions any of these details - do not wait until the end of the conversation.',
        properties: {
          field_name: {
            type: Type.STRING,
            description:
              'The name of the attribute. Required fields: "budget", "authority", "need", "timeline", "contact_name", "email", "schedule_meeting_at". Other fields: "phone", "bedrooms", "location", etc.',
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

    const logToCrmFunction = {
      name: "log_to_crm",
      parameters: {
        type: Type.OBJECT,
        description:
          'Synchronize lead data with Brilworks CRM (Google Sheets). Use this ONLY after the user clicks the "Submit Requirements" button. Use all data captured via capture_information tool. Determine lead_score: HOT (ready to buy, budget confirmed, timeline < 1 month, has authority), WARM (interested, has budget, timeline 1-3 months), or COLD (just browsing, no clear budget/timeline/authority).',
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
        },
        required: [
          "lead_name",
          "contact_info",
          "budget",
          "authority",
          "need",
          "timeline",
          "schedule_meeting_at",
        ],
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

    const startLiveSession = async () => {
      try {
        setIsInitializing(true);
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
        if (!apiKey) {
          console.error(
            "Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.",
          );
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

        const fullSystemInstruction = industry.usesCrmTools
          ? `${baseInstruction}\n\nCurrent lead data: ${memoryText}\n\n${industryRules}\n\nIMPORTANT INSTRUCTIONS:\n1. Use the capture_information tool IMMEDIATELY whenever the user provides ANY information (name, email, phone, budget, timeline, authority, need, location, preferences, etc.). Do NOT wait until the end of the conversation. Call capture_information as soon as each piece of information is mentioned to ensure nothing is lost.\n\n2. BEFORE calling log_to_crm, you MUST verify that ALL required fields are captured:\n   - contact_name (for lead_name)\n   - email (for contact_info)\n   - budget (BANT - B)\n   - authority (BANT - A)\n   - need (BANT - N)\n   - timeline (BANT - T)\n   - schedule_meeting_at\n\n3. If ANY required field is missing when the user tries to submit, politely ask for the missing information and use capture_information to save it. Do NOT proceed with log_to_crm until ALL required fields are present.\n\n4. Example: "Before I can finalize your submission, I need a few more details: [list missing fields]. Could you provide those?"`
          : `${baseInstruction}\n\n${industryRules}`;

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

        const sessionPromise = ai.live.connect({
          model: liveConnectConfig.model,
          callbacks: {
            onopen: () => {
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
                  console.log("fucntioin call", fc);
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

                  sessionPromise.then((s) =>
                    s.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: {
                          result: "Action completed in Brilworks CRM.",
                        },
                      },
                    }),
                  );
                }
              }
            },
            onerror: (e) => {
              console.error("Session error:", e);
              // Only stop if it's a critical error, not just a connection hiccup
              if (e.code && e.code !== "NORMAL_CLOSURE") {
                stopLiveSession();
              }
            },
            onclose: (event) => {
              // Mark session as inactive to prevent audio callbacks from sending data
              isSessionActiveRef.current = false;

              // Log close reason for debugging
              console.log("WebSocket session closed:", {
                code: event.code,
                reason: event.reason || "No reason provided",
                wasClean: event.wasClean,
              });

              // Common close codes:
              // 1000: Normal closure
              // 1001: Going away (server shutdown, browser navigation)
              // 1006: Abnormal closure (no close frame received)
              // 1008: Policy violation
              // 1011: Internal server error
              // 4000+: Custom application codes

              // If it was an abnormal closure, it might be a timeout or network issue
              if (event.code === 1006 || event.code === 1011) {
                console.warn(
                  "Session closed abnormally - possible timeout or network issue",
                );
              }

              // Don't automatically stop on close - let the inactivity timeout handle it
              // This prevents premature disconnections from network issues
              // However, if the session is closed, we should disconnect the audio processor
              if (scriptProcessorRef.current) {
                try {
                  scriptProcessorRef.current.disconnect();
                } catch (e) {
                  // Already disconnected
                }
              }
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
            tools: industry.usesCrmTools
              ? [
                  {
                    functionDeclarations: [
                      captureDataFunction,
                      logToCrmFunction,
                      searchPropertiesFunction,
                    ],
                  },
                ]
              : [],
          },
        });

        sessionPromiseRef.current = sessionPromise;
        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error("Failed to start session", err);
        setIsInitializing(false);
        onStop();
      }
    };

    const stopLiveSession = useCallback(() => {
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

    // Handle starting/stopping based on the isActive prop
    useEffect(() => {
      if (isActive && !sessionRef.current && !isInitializing) {
        startLiveSession();
      } else if (!isActive && sessionRef.current) {
        stopLiveSession();
      }
    }, [isActive]); // Only react to the boolean toggle

    // ONLY cleanup when the component is actually destroyed (unmounted)
    useEffect(() => {
      return () => {
        // This runs ONLY when the user navigates away or closes the tab
        if (sessionRef.current) {
          stopLiveSession();
        }
      };
    }, [stopLiveSession]);

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

    // Disabled automatic syncing to prevent WebSocket errors
    // Instead, we'll send captured data only when session starts or when explicitly needed
    // The data is still available in the component state for the agent to reference

    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-4">
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
            onClick={isActive ? undefined : startLiveSession}
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
