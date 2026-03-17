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

function normalizeCustomFields(customFields) {
  if (!Array.isArray(customFields)) {
    return [];
  }

  return customFields.map((field) => ({
    field_name: String(field?.field_name || "").trim(),
    field_description: String(field?.field_description || "").trim(),
    field_type: String(field?.field_type || "text"),
    is_required: Boolean(field?.is_required),
  }));
}

/**
 * POST /api/agents
 * Create an agent and its custom fields transactionally
 */
export async function POST(request) {
  try {
    const {
      user,
      error: authError,
      db,
    } = await getAuthenticatedContext(request);

    if (authError || !user || !db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const industry = String(body?.industry || "").trim();
    const voicePersona = String(body?.voice_persona || "").trim();
    const systemPrompt = String(body?.system_prompt || "").trim();
    const language = String(body?.language || "en-US");

    if (!name || !industry || !voicePersona || !systemPrompt) {
      return NextResponse.json(
        {
          error: "name, industry, voice_persona and system_prompt are required",
        },
        { status: 400 },
      );
    }

    const toolsEnabled = body?.tools_enabled || {
      capture_information: true,
      log_to_crm: true,
    };

    const customFields = normalizeCustomFields(body?.custom_fields);
    const invalidCustomFieldIndex = customFields.findIndex(
      (field) => !field.field_name,
    );

    if (invalidCustomFieldIndex !== -1) {
      return NextResponse.json(
        {
          error: `Custom field ${invalidCustomFieldIndex + 1} name is required`,
        },
        { status: 400 },
      );
    }

    const { data, error } = await db.rpc("create_agent_with_custom_fields", {
      p_user_id: user.id,
      p_name: name,
      p_industry: industry,
      p_voice_persona: voicePersona,
      p_system_prompt: systemPrompt,
      p_language: language,
      p_tools_enabled: toolsEnabled,
      p_require_customer_info: Boolean(body?.require_customer_info),
      p_collect_bant_info: Boolean(body?.collect_bant_info),
      p_custom_fields: customFields,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ agent: data?.[0] || null });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create agent" },
      { status: 500 },
    );
  }
}
