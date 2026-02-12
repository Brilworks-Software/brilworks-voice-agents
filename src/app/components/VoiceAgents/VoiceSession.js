"use client";
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { encode, decode, decodeAudioData } from './services/audioUtils';
import { getBrilworksBase } from './constants';

const VoiceSession = forwardRef(({ 
  industry, 
  language,
  isActive, 
  onStart, 
  onStop, 
  onMessage, 
  onDataCaptured 
}, ref) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const audioContextRef = useRef(null);
  const outputAudioContextRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionPromiseRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set());
  const transcriptionRef = useRef({ user: '', model: '' });
  const inactivityTimeoutRef = useRef(null);
  const lastUserInteractionRef = useRef(Date.now());
  const streamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const agentSpeakingRef = useRef(false);
  const pendingTimeoutRef = useRef(null);
  const isSessionActiveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    sendMessage: (msg) => {
      if (isSessionActiveRef.current && sessionRef.current) {
        try {
          sessionRef.current.sendRealtimeInput({
            media: { data: encode(new TextEncoder().encode(msg)), mimeType: 'text/plain' }
          });
        } catch (err) {
          // Silently ignore errors - session may be closing
        }
      }
    }
  }));

  const captureDataFunction = {
    name: 'capture_information',
    parameters: {
      type: Type.OBJECT,
      description: 'Capture specific user information identified during the conversation.',
      properties: {
        field_name: { type: Type.STRING, description: 'The name of the attribute (e.g. "budget", "bedrooms", "location", "contact_name", "phone")' },
        value: { type: Type.STRING, description: 'The value associated with the field.' }
      },
      required: ['field_name', 'value']
    }
  };

  const logToCrmFunction = {
    name: 'log_to_crm',
    parameters: {
      type: Type.OBJECT,
      description: 'Synchronize lead data with Brilworks CRM (Google Sheets).',
      properties: {
        lead_name: { type: Type.STRING },
        contact_info: { type: Type.STRING },
        preferences: { type: Type.STRING },
        lead_score: { type: Type.STRING, description: 'Score level: HOT, WARM, or COLD' },
        follow_up_reminder: { type: Type.STRING, description: 'Date or timeframe for next contact' }
      },
      required: ['lead_name', 'lead_score']
    }
  };

  const searchPropertiesFunction = {
    name: 'search_properties',
    parameters: {
      type: Type.OBJECT,
      description: 'Search properties based on filters.',
      properties: {
        budget: { type: Type.STRING },
        bedrooms: { type: Type.STRING },
        location: { type: Type.STRING }
      },
      required: ['budget', 'bedrooms', 'location']
    }
  };

  const startLiveSession = async () => {
    try {
      setIsInitializing(true);
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
      if (!apiKey) {
        console.error('Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.');
        setIsInitializing(false);
        onStop();
        return;
      }
      const ai = new GoogleGenAI({ apiKey });

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Combine standard Brilworks instructions with industry-specific rules
      const fullSystemInstruction = `${getBrilworksBase(language.name)}\n\n${industry.systemInstruction}`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              // Don't process audio if session is not active
              if (!isSessionActiveRef.current || !sessionRef.current) {
                return;
              }
              
              if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
              }
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              // Check if session is still valid before sending
              if (sessionRef.current) {
                try {
                  sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  // Silently ignore errors - session may be closing
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
            
            onStart();
            setIsInitializing(false);
          },
          onmessage: async (message) => {
            // Reset inactivity timeout when user speaks
            if (message.serverContent?.inputTranscription) {
              transcriptionRef.current.user += message.serverContent.inputTranscription.text;
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
            if (message.serverContent?.outputTranscription) {
              transcriptionRef.current.model += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const hadUserInput = !!transcriptionRef.current.user;
              
              if (transcriptionRef.current.user) {
                onMessage('user', transcriptionRef.current.user);
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
              }
              if (transcriptionRef.current.model) onMessage('model', transcriptionRef.current.model);
              transcriptionRef.current = { user: '', model: '' };
              
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
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
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
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
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
                if (fc.name === 'capture_information') {
                  const args = fc.args;
                  onDataCaptured({ [args.field_name]: args.value });
                }
                if (fc.name === 'log_to_crm') {
                  const args = fc.args;
                  onDataCaptured({ 
                    'crm_sync': 'In Progress...',
                    'crm_lead_name': args.lead_name,
                    'lead_score': args.lead_score,
                    'follow_up': args.follow_up_reminder
                  });
                  setTimeout(() => onDataCaptured({ 'crm_sync': 'Synced to Google Sheets ✅' }), 1500);
                }
                if (fc.name === 'search_properties') {
                  const args = fc.args;
                  onDataCaptured({ 
                    'last_search': `${args.budget}, ${args.bedrooms}BR in ${args.location}`,
                    'search_status': 'Scanning Brilworks Database...'
                  });
                }
                
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: { result: "Action completed in Brilworks CRM." }
                  }
                }));
              }
            }
          },
          onerror: (e) => { 
            console.error('Session error:', e); 
            // Only stop if it's a critical error, not just a connection hiccup
            if (e.code && e.code !== 'NORMAL_CLOSURE') {
              stopLiveSession();
            }
          },
          onclose: () => { 
            // Mark session as inactive to prevent audio callbacks from sending data
            isSessionActiveRef.current = false;
            // Don't automatically stop on close - let the inactivity timeout handle it
            // This prevents premature disconnections from network issues
            console.log('Session closed, but keeping connection active');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: fullSystemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [{ functionDeclarations: [captureDataFunction, logToCrmFunction, searchPropertiesFunction] }]
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session', err);
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
      } catch(e) {}
      scriptProcessorRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      streamRef.current = null;
    }
    
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    sessionPromiseRef.current = null;
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch(e) {}
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

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-4">
      <div className="relative">
        {isActive && (
          <div className="absolute inset-0 pulsate bg-blue-400 rounded-full blur-2xl opacity-20 -z-10" />
        )}
        <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
          isActive 
            ? 'bg-blue-600 shadow-xl shadow-blue-300 scale-110' 
            : 'bg-slate-100 hover:bg-slate-200 cursor-pointer border-2 border-slate-200'
        }`} onClick={isActive ? undefined : startLiveSession}>
          {isInitializing ? (
            <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          ) : isActive ? (
            <div className="flex space-x-1 items-end h-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100 + 50}%` }} />
              ))}
            </div>
          ) : (
            <div className="text-4xl">🎙️</div>
          )}
        </div>
      </div>

      <div className="text-center px-4">
        <h4 className="font-bold text-slate-800">
          {isActive ? `${industry.agentName} is Listening...` : isInitializing ? 'Establishing Secure Line...' : `Start Brilworks AI Voice Session`}
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
          {isActive 
            ? `Language: ${language.name}. Syncing to Brilworks CRM.` 
            : `Expert support in multiple languages with ${industry.agentName}`
          }
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
});

VoiceSession.displayName = 'VoiceSession';

export default VoiceSession;
