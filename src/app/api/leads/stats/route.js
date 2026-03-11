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
 * GET /api/leads/stats
 * Get overall lead statistics for the current user
 */
export async function GET(request) {
  try {
    // Get current user
    const {
      user,
      error: authError,
      db,
    } = await getAuthenticatedContext(request);

    if (authError || !user || !db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all leads for user's agents
    const { data: leads, error: leadsError } = await db
      .from("captured_leads")
      .select("*")
      .eq("user_id", user.id);

    if (leadsError) {
      throw leadsError;
    }

    // Calculate statistics
    const stats = {
      total: leads.length,
      hot: leads.filter((l) => l.lead_score === "HOT").length,
      warm: leads.filter((l) => l.lead_score === "WARM").length,
      cold: leads.filter((l) => l.lead_score === "COLD").length,
      withEmail: leads.filter((l) => l.email).length,
      withPhone: leads.filter((l) => l.phone).length,
      withMeeting: leads.filter((l) => l.schedule_meeting_at).length,
    };

    // Get recent leads
    const recentLeads = leads
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 10);

    // Get leads by agent
    const leadsByAgent = leads.reduce((acc, lead) => {
      const agentId = lead.agent_id;
      if (!acc[agentId]) {
        acc[agentId] = {
          total: 0,
          hot: 0,
          warm: 0,
          cold: 0,
        };
      }
      acc[agentId].total++;
      if (lead.lead_score === "HOT") acc[agentId].hot++;
      if (lead.lead_score === "WARM") acc[agentId].warm++;
      if (lead.lead_score === "COLD") acc[agentId].cold++;
      return acc;
    }, {});

    return NextResponse.json({
      stats,
      recentLeads,
      leadsByAgent,
    });
  } catch (error) {
    console.error("Error fetching lead statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
