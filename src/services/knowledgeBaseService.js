import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5";
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;
const KNOWLEDGE_BUCKET = "agent-knowledge";
const EMBEDDING_DIMENSIONS = 768;
const HUGGINGFACE_API_BASE =
  process.env.HUGGINGFACE_API_BASE ||
  "https://router.huggingface.co/hf-inference/models";

function getHuggingFaceToken() {
  const token =
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.NEXT_PUBLIC_HUGGINGFACE_API_TOKEN;
  if (!token) {
    throw new Error(
      "Missing HUGGINGFACE_API_TOKEN (or NEXT_PUBLIC_HUGGINGFACE_API_TOKEN)",
    );
  }
  return token;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sanitizeText(text) {
  // Remove null bytes and other problematic characters that PostgreSQL can't handle
  return text
    .replace(/\u0000/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove other control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

export const knowledgeBaseService = {
  async processPDF(fileBuffer) {
    const parsed = await pdfParse(fileBuffer);
    const rawText = parsed?.text || "";
    const text = sanitizeText(rawText);

    if (!text) {
      throw new Error("Could not extract readable text from PDF");
    }

    return text;
  },

  async chunkDocument(
    text,
    {
      chunkSize = DEFAULT_CHUNK_SIZE,
      chunkOverlap = DEFAULT_CHUNK_OVERLAP,
    } = {},
  ) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    return splitter.splitText(text);
  },

  async generateEmbedding(content) {
    const token = getHuggingFaceToken();
    const response = await fetch(`${HUGGINGFACE_API_BASE}/${EMBEDDING_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: content,
        options: {
          wait_for_model: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face embedding request failed: ${errorText}`);
    }

    const result = await response.json();
    // BAAI/bge models return embeddings directly as array
    const values = Array.isArray(result) ? result : null;

    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Failed to generate valid Hugging Face embedding vector (expected ${EMBEDDING_DIMENSIONS} dimensions)`,
      );
    }

    return values;
  },

  async storeChunks({
    supabase,
    agentId,
    documentId,
    userId,
    chunks,
    baseMetadata = {},
  }) {
    if (!chunks.length) {
      return 0;
    }

    const records = [];
    for (let index = 0; index < chunks.length; index += 1) {
      // Sanitize chunk text to ensure no null bytes reach the database
      const chunkText = sanitizeText(chunks[index]);
      const embedding = await this.generateEmbedding(chunkText);

      records.push({
        agent_id: agentId,
        document_id: documentId,
        user_id: userId,
        chunk_text: chunkText,
        embedding,
        metadata: {
          ...baseMetadata,
          chunk_index: index,
        },
      });
    }

    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("agent_knowledge_chunks")
        .insert(batch);
      if (error) {
        throw error;
      }
    }

    return records.length;
  },

  async uploadAndIndexPDF({ supabase, agentId, userId, file }) {
    const { data: existingDocument, error: existingError } = await supabase
      .from("agent_knowledge_documents")
      .select("id")
      .eq("agent_id", agentId)
      .eq("user_id", userId)
      .eq("file_name", file.name)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingDocument) {
      const { count, error: countError } = await supabase
        .from("agent_knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", existingDocument.id);

      if (countError) {
        throw countError;
      }

      return {
        reused: true,
        chunksStored: count || 0,
      };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${userId}/${agentId}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Failed to upload PDF to storage bucket '${KNOWLEDGE_BUCKET}': ${uploadError.message}`,
      );
    }

    const { data: document, error: docError } = await supabase
      .from("agent_knowledge_documents")
      .insert({
        agent_id: agentId,
        user_id: userId,
        file_name: file.name,
        file_url: storagePath,
      })
      .select("id")
      .single();

    if (docError || !document) {
      throw docError || new Error("Failed to create knowledge document record");
    }

    const text = await this.processPDF(fileBuffer);
    const chunks = await this.chunkDocument(text);

    const chunksStored = await this.storeChunks({
      supabase,
      agentId,
      documentId: document.id,
      userId,
      chunks,
      baseMetadata: {
        source: file.name,
      },
    });

    return {
      reused: false,
      chunksStored,
    };
  },

  async retrieveRelevantChunks({ supabase, agentId, query, limit = 5 }) {
    const queryEmbedding = await this.generateEmbedding(query);

    const { data, error } = await supabase.rpc("match_agent_knowledge_chunks", {
      p_agent_id: agentId,
      p_query_embedding: queryEmbedding,
      p_match_count: limit,
    });

    if (error) {
      throw error;
    }

    return data || [];
  },
};
