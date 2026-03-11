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
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") || "10");
    const offset = Number.parseInt(searchParams.get("offset") || "0");

    // Get current user
    const {
      user,
      error: authError,
      db,
    } = await getAuthenticatedContext(request);

    if (authError || !user || !db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all leads for aggregate statistics
    const { data: allLeads, error: leadsError } = await db
      .from("captured_leads")
      .select("lead_score, email, phone, schedule_meeting_at, agent_id")
      .eq("user_id", user.id);

    if (leadsError) {
      throw leadsError;
    }

    // Get paginated leads list for table rendering
    const {
      data: recentLeads,
      error: recentLeadsError,
      count,
    } = await db
      .from("captured_leads")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (recentLeadsError) {
      throw recentLeadsError;
    }

    // Calculate statistics
    const stats = {
      total: allLeads.length,
      hot: allLeads.filter((l) => l.lead_score === "HOT").length,
      warm: allLeads.filter((l) => l.lead_score === "WARM").length,
      cold: allLeads.filter((l) => l.lead_score === "COLD").length,
      withEmail: allLeads.filter((l) => l.email).length,
      withPhone: allLeads.filter((l) => l.phone).length,
      withMeeting: allLeads.filter((l) => l.schedule_meeting_at).length,
    };

    // Get leads by agent
    const leadsByAgent = allLeads.reduce((acc, lead) => {
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
      recentLeads: recentLeads || [],
      leadsByAgent,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching lead statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
