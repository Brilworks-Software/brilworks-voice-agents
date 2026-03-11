import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/server";

export async function PATCH(request, { params }) {
  try {
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

    const body = await request.json();
    const { id } = await params;

    const payload = {
      name: body.name,
      industry: body.industry,
      voice_persona: body.voice_persona,
      system_prompt: body.system_prompt,
      language: body.language,
      tools_enabled: body.tools_enabled || {
        capture_information: true,
        log_to_crm: true,
      },
      require_customer_info: body.require_customer_info || false,
      collect_bant_info: body.collect_bant_info || false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("voice_agents")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update agent" },
        { status: 400 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
