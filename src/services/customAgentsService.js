"use client";

import { supabase } from "../../lib/supabase/client";

export const customAgentsService = {
  // Create a new custom agent
  async createAgent(agentData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("voice_agents")
      .insert([
        {
          user_id: user.id,
          name: agentData.name,
          industry: agentData.industry,
          voice_persona: agentData.voice_persona,
          system_prompt: agentData.system_prompt,
          language: agentData.language,
          tools_enabled: agentData.tools_enabled || {
            capture_information: true,
            log_to_crm: true,
          },
          require_customer_info: agentData.require_customer_info || false,
          collect_bant_info: agentData.collect_bant_info || false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    return data?.[0];
  },

  // Update an existing agent
  async updateAgent(agentId, agentData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("User session is not available");
    }

    const response = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: agentData.name,
        industry: agentData.industry,
        voice_persona: agentData.voice_persona,
        system_prompt: agentData.system_prompt,
        language: agentData.language,
        tools_enabled: agentData.tools_enabled || {
          capture_information: true,
          log_to_crm: true,
        },
        require_customer_info: agentData.require_customer_info || false,
        collect_bant_info: agentData.collect_bant_info || false,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const message = result?.error || "Failed to update agent";
      throw new Error(message);
    }

    return result.data;
  },

  // Delete an agent
  async deleteAgent(agentId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("voice_agents")
      .delete()
      .eq("id", agentId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  },

  // Get all agents for current user
  async getUserAgents() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("voice_agents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  },

  // Get a single agent by ID
  async getAgentById(agentId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("voice_agents")
      .select("*")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  // Save conversation for an agent
  async saveConversation(conversationData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("agent_conversations")
      .insert([
        {
          user_id: user.id,
          agent_id: conversationData.agent_id,
          messages: conversationData.messages,
          lead_data: conversationData.lead_data || {},
          created_at: new Date(),
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    return data?.[0];
  },

  // Get conversations for an agent
  async getAgentConversations(agentId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("agent_conversations")
      .select("*")
      .eq("agent_id", agentId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  },

  async uploadKnowledgeFiles(agentId, files) {
    if (!files?.length) {
      return { success: true, chunksStored: 0 };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("User session is not available");
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch(`/api/agents/${agentId}/knowledge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to upload knowledge files");
    }

    return result;
  },

  async getKnowledgeDocuments(agentId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("User session is not available");
    }

    const response = await fetch(`/api/agents/${agentId}/knowledge`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to load knowledge documents");
    }

    return result.documents || [];
  },
};
