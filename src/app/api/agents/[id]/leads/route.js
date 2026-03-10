import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/agents/[id]/leads
 * Retrieve all captured leads for a specific agent
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createServerClient();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from("voice_agents")
      .select("id, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get leads
    const {
      data: leads,
      error: leadsError,
      count,
    } = await supabase
      .from("captured_leads")
      .select("*", { count: "exact" })
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (leadsError) {
      throw leadsError;
    }

    // Get statistics
    const { data: stats } = await supabase
      .from("captured_leads")
      .select("lead_score")
      .eq("agent_id", id);

    const statistics = {
      total: count || 0,
      hot: stats ? stats.filter((s) => s.lead_score === "HOT").length : 0,
      warm: stats ? stats.filter((s) => s.lead_score === "WARM").length : 0,
      cold: stats ? stats.filter((s) => s.lead_score === "COLD").length : 0,
    };

    return NextResponse.json({
      leads: leads || [],
      statistics,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agents/[id]/leads
 * Create a new captured lead
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createServerClient();
    const { id } = params;
    const body = await request.json();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from("voice_agents")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Create lead record
    const leadData = {
      user_id: user.id,
      agent_id: id,
      conversation_id: body.conversation_id || null,
      lead_name: body.lead_name || body.contact_name || "Anonymous",
      email: body.email || body.contact_info?.split("|")[0]?.trim() || null,
      phone: body.phone || body.contact_info?.split("|")[1]?.trim() || null,
      budget: body.budget || null,
      authority: body.authority || null,
      need: body.need || null,
      timeline: body.timeline || null,
      lead_score: body.lead_score || null,
      schedule_meeting_at: body.schedule_meeting_at || null,
      custom_fields: body.custom_fields || {},
      conversation_duration: body.conversation_duration || 0,
      messages_count: body.messages_count || 0,
    };

    const { data: lead, error: leadError } = await supabase
      .from("captured_leads")
      .insert(leadData)
      .select()
      .single();

    if (leadError) {
      throw leadError;
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 },
    );
  }
}
