import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { knowledgeBaseService } from "@/services/knowledgeBaseService";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from("voice_agents")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const query = body?.query?.trim();
    const limit = Number(body?.limit) || 3;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log("Query", body);

    const chunks = await knowledgeBaseService.retrieveRelevantChunks({
      supabase: supabaseAdmin,
      agentId: id,
      query,
      limit: Math.min(Math.max(limit, 1), 8),
    });
    console.log("Retrieved chunks:", chunks);
    return NextResponse.json({
      success: true,
      chunks,
      contextText: chunks
        .map((chunk, index) => `[Chunk ${index + 1}] ${chunk.chunk_text}`)
        .join("\n\n"),
    });
  } catch (error) {
    console.error("Error searching knowledge documents:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to search knowledge documents",
      },
      { status: 500 },
    );
  }
}
