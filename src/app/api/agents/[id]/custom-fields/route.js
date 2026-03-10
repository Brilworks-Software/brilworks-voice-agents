import { supabaseAdmin } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/agents/[id]/custom-fields
 * Retrieve custom fields for a specific agent
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("voice_agents")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get custom fields
    const { data: customFields, error: fieldsError } = await supabaseAdmin
      .from("agent_custom_fields")
      .select("*")
      .eq("agent_id", id)
      .order("display_order", { ascending: true });

    if (fieldsError) {
      throw fieldsError;
    }

    return NextResponse.json({ customFields: customFields || [] });
  } catch (error) {
    console.error("Error fetching custom fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom fields" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agents/[id]/custom-fields
 * Create or update custom fields for an agent
 */
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

    const body = await request.json();
    const { customFields } = body;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("voice_agents")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete existing custom fields
    await supabaseAdmin.from("agent_custom_fields").delete().eq("agent_id", id);

    // Insert new custom fields
    if (customFields && customFields.length > 0) {
      const fieldsToInsert = customFields.map((field, index) => ({
        user_id: user.id,
        agent_id: id,
        field_name: field.field_name,
        field_description: field.field_description || "",
        field_type: field.field_type || "text",
        is_required: field.is_required || false,
        display_order: index,
      }));

      const { data: insertedFields, error: insertError } = await supabaseAdmin
        .from("agent_custom_fields")
        .insert(fieldsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({ customFields: insertedFields });
    }

    return NextResponse.json({ customFields: [] });
  } catch (error) {
    console.error("Error saving custom fields:", error);
    return NextResponse.json(
      { error: "Failed to save custom fields" },
      { status: 500 },
    );
  }
}
