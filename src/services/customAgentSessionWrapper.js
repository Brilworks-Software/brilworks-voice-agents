"use client";

/**
 * Custom Agent Session Wrapper
 *
 * This module provides utilities to create properly configured voice sessions
 * for custom user-created agents without modifying the core VoiceSession component.
 */

/**
 * Creates a configuration object for running a custom voice agent
 *
 * @param {Object} agentConfig - Custom agent configuration from database
 * @param {string} agentConfig.name - Agent name
 * @param {string} agentConfig.industry - Agent industry
 * @param {string} agentConfig.voice_persona - Voice persona (Professional, Friendly, etc)
 * @param {string} agentConfig.system_prompt - Custom system prompt
 * @param {string} agentConfig.language - Language code (e.g., 'en-US')
 * @param {Object} agentConfig.tools_enabled - Enabled tools
 *
 * @returns {Object} Configured session object ready to pass to VoiceSession
 */
export const createCustomAgentSession = (agentConfig) => {
  if (!agentConfig) {
    throw new Error("Agent configuration is required");
  }

  // Enhanced system prompt that includes custom instructions
  const enhancedSystemPrompt = buildSystemPrompt(agentConfig);

  return {
    industry: agentConfig.industry,
    language: agentConfig.language,
    name: agentConfig.name,
    voicePersona: agentConfig.voice_persona,
    systemPrompt: enhancedSystemPrompt,
    toolsEnabled: agentConfig.tools_enabled || {
      capture_information: true,
      log_to_crm: true,
    },
    // Internal configuration (not passed to VoiceSession)
    _raw: agentConfig,
  };
};

/**
 * Builds an enhanced system prompt from custom agent configuration
 * Combines the custom prompt with necessary framework instructions
 */
const buildSystemPrompt = (agentConfig) => {
  const basePrompt = agentConfig.system_prompt || "";

  // Build voice persona instructions
  const personaInstructions = getPersonaInstructions(agentConfig.voice_persona);

  // Top-level instruction for multi-language support
  const languageInstruction = getLanguageInstruction(agentConfig.language);

  return [
    basePrompt,
    personaInstructions,
    languageInstruction,
    "\nIMPORTANT: Maintain natural conversation flow. Ask one question at a time and actively listen to responses.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Returns personality-specific instructions based on voice persona
 */
const getPersonaInstructions = (persona) => {
  const instructions = {
    Professional:
      "Maintain a professional, formal tone. Be efficient and direct. Use industry terminology appropriately.",
    Friendly:
      "Be warm and approachable. Use conversational language. Show empathy and understanding.",
    "Sales Expert":
      "Focus on understanding customer needs. Highlight value propositions. Gently guide toward solutions.",
    "Customer Support":
      "Prioritize solving customer problems. Show patience and understanding. Go the extra mile to help.",
    Consultant:
      "Provide expert insights and recommendations. Ask clarifying questions. Think strategically about solutions.",
  };

  return instructions[persona] || "";
};

/**
 * Returns language-specific instructions
 */
const getLanguageInstruction = (language) => {
  if (language === "auto") {
    return "LANGUAGE: Detect the user's language automatically and respond in that same language.";
  }

  const languageNames = {
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

  const langName = languageNames[language] || language;
  return `LANGUAGE: You MUST respond exclusively in ${langName}. Do not switch languages even if the user does.`;
};

/**
 * Validates agent configuration
 */
export const validateAgentConfig = (config) => {
  const errors = [];

  if (!config.name || !config.name.trim()) {
    errors.push("Agent name is required");
  }

  if (!config.industry) {
    errors.push("Industry is required");
  }

  if (!config.voice_persona) {
    errors.push("Voice persona is required");
  }

  if (!config.system_prompt || !config.system_prompt.trim()) {
    errors.push("System prompt is required");
  }

  if (!config.language) {
    errors.push("Language is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Transforms database agent record to session configuration
 */
export const dbAgentToSessionConfig = (dbAgent) => {
  return createCustomAgentSession({
    name: dbAgent.name,
    industry: dbAgent.industry,
    voice_persona: dbAgent.voice_persona,
    system_prompt: dbAgent.system_prompt,
    language: dbAgent.language,
    tools_enabled: dbAgent.tools_enabled,
  });
};

/**
 * Common agent templates for quick setup
 */
export const AGENT_TEMPLATES = {
  sales: {
    voice_persona: "Sales Expert",
    system_prompt:
      "You are a sales expert for a business. Your goal is to understand customer needs, present relevant solutions, and qualify leads for the sales team. Always be helpful, non-pushy, and focused on providing value.",
  },
  support: {
    voice_persona: "Customer Support",
    system_prompt:
      "You are a customer support specialist. Your goal is to resolve customer issues quickly and professionally. Be empathetic, patient, and thorough in your assistance. Escalate complex issues when necessary.",
  },
  consultation: {
    voice_persona: "Consultant",
    system_prompt:
      "You are a consultant providing expert guidance. Ask clarifying questions to understand the client's situation, provide strategic recommendations, and help them think through solutions. Be professional and insightful.",
  },
  appointment: {
    voice_persona: "Professional",
    system_prompt:
      "You are an appointment scheduler. Your primary goal is to book appointments efficiently. Gather necessary information, check availability, and confirm bookings. Be organized and professional.",
  },
};
