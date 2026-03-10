import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { langchainAgentService } from "@/services/langchainAgentService";

function createAuthedSupabaseClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const message = body?.message?.trim();
    const conversationId = body?.conversation_id?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 },
      );
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    const supabase = token
      ? createAuthedSupabaseClient(token)
      : createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent, error: agentError } = await supabase
      .from("voice_agents")
      .select("id, system_prompt")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await langchainAgentService.handleConversation({
      supabase,
      agentId: id,
      systemPrompt: agent.system_prompt,
      message,
      conversationId,
    });

    return NextResponse.json({
      success: true,
      response: result.message,
      retrievedChunksCount: result.retrievedChunks.length,
    });
  } catch (error) {
    console.error("Error in RAG chat endpoint:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to process chat request",
      },
      { status: 500 },
    );
  }
}
