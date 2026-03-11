import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { knowledgeBaseService } from "@/services/knowledgeBaseService";

// Global store for conversation history per session
const conversationHistories = {};

function getConversationHistory(conversationId) {
  if (!conversationHistories[conversationId]) {
    conversationHistories[conversationId] = new InMemoryChatMessageHistory();
  }
  return conversationHistories[conversationId];
}

function getLLM() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
  }

  return new ChatGoogleGenerativeAI({
    apiKey,
    modelName: "gemini-2.0-flash",
    temperature: 0.3,
    maxOutputTokens: 1024,
  });
}

export const langchainAgentService = {
  async retrieveKnowledgeContext({ supabase, agentId, message }) {
    try {
      const chunks = await knowledgeBaseService.retrieveRelevantChunks({
        supabase,
        agentId,
        query: message,
        limit: 5,
      });

      const contextText = chunks
        .map((chunk, index) => `[Chunk ${index + 1}] ${chunk.chunk_text}`)
        .join("\n\n");

      return {
        chunks,
        contextText,
      };
    } catch (error) {
      console.warn("Failed to retrieve knowledge context:", error);
      return {
        chunks: [],
        contextText: "",
      };
    }
  },

  async generateResponse({
    llm,
    systemPrompt,
    message,
    contextText,
    conversationHistory,
  }) {
    // Get conversation history messages
    const historyMessages = await conversationHistory.getMessages();

    // Build system message
    const systemMessage = new SystemMessage(`You are an AI voice sales agent.

You have access to a knowledge base that contains documents uploaded by the user.

When answering questions:
1. Use the knowledge base context when relevant.
2. If the knowledge base contains the answer, prioritize it.
3. If the answer is not found, respond normally based on your capabilities.

Agent-specific behavior:
${systemPrompt}

Knowledge Base Context:
${contextText || "No relevant knowledge chunks found."}`);

    // Prepare messages: system + history + new user message
    const messages = [
      systemMessage,
      ...historyMessages,
      new HumanMessage(message),
    ];

    // Call the LLM
    const response = await llm.invoke(messages);

    // Extract text from response
    let responseText = "I can help with that. Could you clarify?";
    if (typeof response?.content === "string") {
      responseText = response.content.trim();
    } else if (Array.isArray(response?.content)) {
      const textContent = response.content
        .filter((item) => typeof item === "string" || item?.type === "text")
        .map((item) => (typeof item === "string" ? item : item?.text || ""))
        .join(" ")
        .trim();
      if (textContent) {
        responseText = textContent;
      }
    }

    return responseText;
  },

  async handleConversation({
    supabase,
    agentId,
    systemPrompt,
    message,
    conversationId,
  }) {
    const llm = getLLM();
    const history = getConversationHistory(conversationId);

    // Add user message to history
    await history.addUserMessage(message);

    // Retrieve relevant knowledge chunks
    const { contextText, chunks } = await this.retrieveKnowledgeContext({
      supabase,
      agentId,
      message,
    });

    // Generate response
    const response = await this.generateResponse({
      llm,
      systemPrompt,
      message,
      contextText,
      conversationHistory: history,
    });

    // Add AI response to history
    await history.addAIMessage(response);

    return {
      message: response,
      retrievedChunks: chunks,
    };
  },
};
