import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getAuthenticatedContext(request) {
  const supabase = await createServerClient();
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (token) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        error: error || new Error("Unauthorized"),
        db: null,
      };
    }

    return { user, error: null, db: supabaseAdmin };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: error || new Error("Unauthorized"), db: null };
  }

  return { user, error: null, db: supabase };
}

/**
 * GET /api/agents
 * List all agents for the authenticated user
 */
export async function GET(request) {
  try {
    const {
      user,
      error: authError,
      db,
    } = await getAuthenticatedContext(request);

    if (authError || !user || !db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agents, error } = await db
      .from("voice_agents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}
