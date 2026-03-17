import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { knowledgeBaseService } from "@/services/knowledgeBaseService";
import {
  formatBytes,
  KNOWLEDGE_UPLOAD_LIMITS,
} from "@/lib/knowledgeUploadLimits";

export const runtime = "nodejs";

async function getAuthorizedContext(request, agentId) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: agent, error: agentError } = await supabaseAdmin
    .from("voice_agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .single();

  if (agentError || !agent) {
    return {
      error: NextResponse.json({ error: "Agent not found" }, { status: 404 }),
    };
  }

  return { user };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const context = await getAuthorizedContext(request, id);
    if (context.error) {
      return context.error;
    }

    const { data: documents, error } = await supabaseAdmin
      .from("agent_knowledge_documents")
      .select("id, file_name, file_url, created_at")
      .eq("agent_id", id)
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const docsWithPreviewUrl = await Promise.all(
      (documents || []).map(async (doc) => {
        let viewUrl = null;

        if (doc.file_url) {
          const { data: signedData, error: signedUrlError } =
            await supabaseAdmin.storage
              .from("agent-knowledge")
              .createSignedUrl(doc.file_url, 60 * 30);

          if (!signedUrlError) {
            viewUrl = signedData?.signedUrl || null;
          }
        }

        return {
          id: doc.id,
          fileName: doc.file_name,
          createdAt: doc.created_at,
          viewUrl,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      documents: docsWithPreviewUrl,
    });
  } catch (error) {
    console.error("Error listing knowledge documents:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to list knowledge documents",
      },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const context = await getAuthorizedContext(request, id);
    if (context.error) {
      return context.error;
    }

    const formData = await request.formData();
    const rawFiles = formData
      .getAll("files")
      .filter((file) => file instanceof File);

    if (!rawFiles.length) {
      return NextResponse.json(
        { error: "At least one PDF file is required" },
        { status: 400 },
      );
    }

    if (rawFiles.length > KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest) {
      return NextResponse.json(
        {
          error: `Maximum ${KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest} PDFs are allowed per upload`,
        },
        { status: 400 },
      );
    }

    const nonPdfFile = rawFiles.find((file) => file.type !== "application/pdf");
    if (nonPdfFile) {
      return NextResponse.json(
        {
          error: `Only PDF files are allowed. '${nonPdfFile.name}' is not a PDF.`,
        },
        { status: 400 },
      );
    }

    const oversizedFile = rawFiles.find(
      (file) => file.size > KNOWLEDGE_UPLOAD_LIMITS.maxFileSizeBytes,
    );
    if (oversizedFile) {
      return NextResponse.json(
        {
          error: `File '${oversizedFile.name}' exceeds max size of ${formatBytes(KNOWLEDGE_UPLOAD_LIMITS.maxFileSizeBytes)}.`,
        },
        { status: 400 },
      );
    }

    const files = rawFiles;

    let chunksStored = 0;
    const documents = [];

    for (const file of files) {
      const result = await knowledgeBaseService.uploadAndIndexPDF({
        supabase: supabaseAdmin,
        agentId: id,
        userId: context.user.id,
        file,
      });

      chunksStored += result.chunksStored;
      documents.push({
        fileName: file.name,
        chunksStored: result.chunksStored,
        reused: result.reused,
      });
    }

    return NextResponse.json({
      success: true,
      chunksStored,
      documents,
    });
  } catch (error) {
    console.error("Error uploading knowledge documents:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to process knowledge documents",
      },
      { status: 500 },
    );
  }
}
