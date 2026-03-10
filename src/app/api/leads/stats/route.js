import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/leads/stats
 * Get overall lead statistics for the current user
 */
export async function GET(request) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all leads for user's agents
    const { data: leads, error: leadsError } = await supabase
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
