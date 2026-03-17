-- ============================================================================
-- Custom Voice Agents Platform - Unified Supabase Database Setup
-- ============================================================================
-- SAFE TO RUN MULTIPLE TIMES
-- This script combines full setup + incremental updates and includes:
-- - Base tables: voice_agents, agent_conversations
-- - Lead capture: agent_custom_fields, captured_leads
-- - Knowledge base (RAG): documents + chunks + vector search function
-- - RLS policies for all tables
-- - Triggers for updated_at
-- - Dashboard views (agent_summary, lead_details)
-- ============================================================================

-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================================
-- Step 1: Core tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  voice_persona TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  language TEXT DEFAULT 'en-US',
  services JSONB DEFAULT '[]',
  tools_enabled JSONB DEFAULT '{
    "capture_information": true,
    "log_to_crm": true
  }',
  require_customer_info BOOLEAN DEFAULT false,
  collect_bant_info BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  lead_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- ============================================================================
-- Step 2: Backward-compatible column additions (for older DBs)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'voice_agents'
      AND column_name = 'require_customer_info'
  ) THEN
    ALTER TABLE voice_agents ADD COLUMN require_customer_info BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'voice_agents'
      AND column_name = 'collect_bant_info'
  ) THEN
    ALTER TABLE voice_agents ADD COLUMN collect_bant_info BOOLEAN DEFAULT false;
  END IF;
END $$;


-- ============================================================================
-- Step 3: Lead capture tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_description TEXT,
  field_type TEXT DEFAULT 'text',
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS captured_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  lead_name TEXT,
  email TEXT,
  phone TEXT,
  budget TEXT,
  authority TEXT,
  need TEXT,
  timeline TEXT,
  lead_score TEXT,
  schedule_meeting_at TEXT,
  custom_fields JSONB DEFAULT '{}',
  conversation_duration INTEGER,
  messages_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- ============================================================================
-- Step 4: Knowledge base tables (RAG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES agent_knowledge_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- ============================================================================
-- Step 5: Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_voice_agents_user_id
  ON voice_agents(user_id);

CREATE INDEX IF NOT EXISTS idx_voice_agents_created_at
  ON voice_agents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_id
  ON agent_conversations(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id
  ON agent_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at
  ON agent_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_custom_fields_agent_id
  ON agent_custom_fields(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_custom_fields_user_id
  ON agent_custom_fields(user_id);

CREATE INDEX IF NOT EXISTS idx_captured_leads_agent_id
  ON captured_leads(agent_id);

CREATE INDEX IF NOT EXISTS idx_captured_leads_user_id
  ON captured_leads(user_id);

CREATE INDEX IF NOT EXISTS idx_captured_leads_email
  ON captured_leads(email);

CREATE INDEX IF NOT EXISTS idx_captured_leads_created_at
  ON captured_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_captured_leads_lead_score
  ON captured_leads(lead_score);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_documents_agent_id
  ON agent_knowledge_documents(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_documents_user_id
  ON agent_knowledge_documents(user_id);

CREATE INDEX IF NOT EXISTS agent_knowledge_agent_id_idx
  ON agent_knowledge_chunks(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_chunks_user_id
  ON agent_knowledge_chunks(user_id);

CREATE INDEX IF NOT EXISTS agent_knowledge_embedding_idx
  ON agent_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ============================================================================
-- Step 6: Enable RLS
-- ============================================================================

ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 7: RLS Policies (drop + recreate for idempotency)
-- ============================================================================

-- voice_agents
DROP POLICY IF EXISTS "Users can only view their own agents" ON voice_agents;
CREATE POLICY "Users can only view their own agents"
  ON voice_agents
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only create agents" ON voice_agents;
CREATE POLICY "Users can only create agents"
  ON voice_agents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own agents" ON voice_agents;
CREATE POLICY "Users can only update their own agents"
  ON voice_agents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own agents" ON voice_agents;
CREATE POLICY "Users can only delete their own agents"
  ON voice_agents
  FOR DELETE
  USING (auth.uid() = user_id);

-- agent_conversations
DROP POLICY IF EXISTS "Users can only view their own conversations" ON agent_conversations;
CREATE POLICY "Users can only view their own conversations"
  ON agent_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only create conversations" ON agent_conversations;
CREATE POLICY "Users can only create conversations"
  ON agent_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- agent_custom_fields
DROP POLICY IF EXISTS "Users can view their own custom fields" ON agent_custom_fields;
CREATE POLICY "Users can view their own custom fields"
  ON agent_custom_fields
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create custom fields" ON agent_custom_fields;
CREATE POLICY "Users can create custom fields"
  ON agent_custom_fields
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own custom fields" ON agent_custom_fields;
CREATE POLICY "Users can update their own custom fields"
  ON agent_custom_fields
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own custom fields" ON agent_custom_fields;
CREATE POLICY "Users can delete their own custom fields"
  ON agent_custom_fields
  FOR DELETE
  USING (auth.uid() = user_id);

-- captured_leads
DROP POLICY IF EXISTS "Users can view their own captured leads" ON captured_leads;
CREATE POLICY "Users can view their own captured leads"
  ON captured_leads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create captured leads" ON captured_leads;
CREATE POLICY "Users can create captured leads"
  ON captured_leads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own captured leads" ON captured_leads;
CREATE POLICY "Users can update their own captured leads"
  ON captured_leads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own captured leads" ON captured_leads;
CREATE POLICY "Users can delete their own captured leads"
  ON captured_leads
  FOR DELETE
  USING (auth.uid() = user_id);

-- agent_knowledge_documents
DROP POLICY IF EXISTS "Users can view their own knowledge documents" ON agent_knowledge_documents;
CREATE POLICY "Users can view their own knowledge documents"
  ON agent_knowledge_documents
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create knowledge documents" ON agent_knowledge_documents;
CREATE POLICY "Users can create knowledge documents"
  ON agent_knowledge_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own knowledge documents" ON agent_knowledge_documents;
CREATE POLICY "Users can update their own knowledge documents"
  ON agent_knowledge_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own knowledge documents" ON agent_knowledge_documents;
CREATE POLICY "Users can delete their own knowledge documents"
  ON agent_knowledge_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- agent_knowledge_chunks
DROP POLICY IF EXISTS "Users can view their own knowledge chunks" ON agent_knowledge_chunks;
CREATE POLICY "Users can view their own knowledge chunks"
  ON agent_knowledge_chunks
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create knowledge chunks" ON agent_knowledge_chunks;
CREATE POLICY "Users can create knowledge chunks"
  ON agent_knowledge_chunks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON agent_knowledge_chunks;
CREATE POLICY "Users can update their own knowledge chunks"
  ON agent_knowledge_chunks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON agent_knowledge_chunks;
CREATE POLICY "Users can delete their own knowledge chunks"
  ON agent_knowledge_chunks
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Step 8: Trigger functions + triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_voice_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_voice_agents_updated_at ON voice_agents;
CREATE TRIGGER trigger_update_voice_agents_updated_at
  BEFORE UPDATE ON voice_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_agents_updated_at();

CREATE OR REPLACE FUNCTION update_captured_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_captured_leads_updated_at ON captured_leads;
CREATE TRIGGER trigger_update_captured_leads_updated_at
  BEFORE UPDATE ON captured_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_captured_leads_updated_at();


-- ============================================================================
-- Step 9: Views
-- ============================================================================

DROP VIEW IF EXISTS agent_summary;
CREATE OR REPLACE VIEW agent_summary AS
SELECT
  va.id,
  va.user_id,
  va.name,
  va.industry,
  va.voice_persona,
  va.language,
  va.created_at,
  COUNT(DISTINCT ac.id) AS conversation_count,
  COUNT(DISTINCT cl.id) AS leads_count,
  COUNT(DISTINCT CASE WHEN cl.lead_score = 'HOT' THEN cl.id END) AS hot_leads_count,
  COUNT(DISTINCT CASE WHEN cl.lead_score = 'WARM' THEN cl.id END) AS warm_leads_count,
  COUNT(DISTINCT CASE WHEN cl.lead_score = 'COLD' THEN cl.id END) AS cold_leads_count
FROM voice_agents va
LEFT JOIN agent_conversations ac ON va.id = ac.agent_id
LEFT JOIN captured_leads cl ON va.id = cl.agent_id
GROUP BY va.id
ORDER BY va.created_at DESC;

DROP VIEW IF EXISTS lead_details;
CREATE OR REPLACE VIEW lead_details AS
SELECT
  cl.id,
  cl.user_id,
  cl.agent_id,
  va.name AS agent_name,
  cl.lead_name,
  cl.email,
  cl.phone,
  cl.budget,
  cl.authority,
  cl.need,
  cl.timeline,
  cl.lead_score,
  cl.schedule_meeting_at,
  cl.custom_fields,
  cl.conversation_duration,
  cl.messages_count,
  cl.created_at,
  cl.updated_at
FROM captured_leads cl
LEFT JOIN voice_agents va ON cl.agent_id = va.id
ORDER BY cl.created_at DESC;


-- ============================================================================
-- Step 10: Transactional create-agent function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_agent_with_custom_fields(
  p_user_id UUID,
  p_name TEXT,
  p_industry TEXT,
  p_voice_persona TEXT,
  p_system_prompt TEXT,
  p_language TEXT DEFAULT 'en-US',
  p_tools_enabled JSONB DEFAULT '{"capture_information": true, "log_to_crm": true}'::JSONB,
  p_require_customer_info BOOLEAN DEFAULT false,
  p_collect_bant_info BOOLEAN DEFAULT false,
  p_custom_fields JSONB DEFAULT '[]'::JSONB
)
RETURNS SETOF voice_agents
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent voice_agents%ROWTYPE;
BEGIN
  INSERT INTO voice_agents (
    user_id,
    name,
    industry,
    voice_persona,
    system_prompt,
    language,
    tools_enabled,
    require_customer_info,
    collect_bant_info
  )
  VALUES (
    p_user_id,
    p_name,
    p_industry,
    p_voice_persona,
    p_system_prompt,
    p_language,
    COALESCE(p_tools_enabled, '{"capture_information": true, "log_to_crm": true}'::JSONB),
    COALESCE(p_require_customer_info, false),
    COALESCE(p_collect_bant_info, false)
  )
  RETURNING * INTO v_agent;

  IF jsonb_typeof(COALESCE(p_custom_fields, '[]'::JSONB)) = 'array'
     AND jsonb_array_length(COALESCE(p_custom_fields, '[]'::JSONB)) > 0 THEN
    INSERT INTO agent_custom_fields (
      user_id,
      agent_id,
      field_name,
      field_description,
      field_type,
      is_required,
      display_order
    )
    SELECT
      p_user_id,
      v_agent.id,
      TRIM(COALESCE(field.field_name, '')),
      COALESCE(field.field_description, ''),
      COALESCE(field.field_type, 'text'),
      COALESCE(field.is_required, false),
      field.display_order
    FROM (
      SELECT
        (elem->>'field_name') AS field_name,
        (elem->>'field_description') AS field_description,
        (elem->>'field_type') AS field_type,
        ((elem->>'is_required')::BOOLEAN) AS is_required,
        ordinality - 1 AS display_order
      FROM jsonb_array_elements(p_custom_fields) WITH ORDINALITY AS t(elem, ordinality)
    ) AS field;
  END IF;

  RETURN NEXT v_agent;
END;
$$;


-- ============================================================================
-- Step 11: Similarity search function for knowledge retrieval
-- ============================================================================

CREATE OR REPLACE FUNCTION match_agent_knowledge_chunks(
  p_agent_id UUID,
  p_query_embedding VECTOR(768),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    akc.id,
    akc.chunk_text,
    akc.metadata,
    1 - (akc.embedding <=> p_query_embedding) AS similarity
  FROM agent_knowledge_chunks akc
  WHERE akc.agent_id = p_agent_id
  ORDER BY akc.embedding <-> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;


-- ============================================================================
-- Verification Queries (optional)
-- ============================================================================

-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'voice_agents',
--     'agent_conversations',
--     'agent_custom_fields',
--     'captured_leads',
--     'agent_knowledge_documents',
--     'agent_knowledge_chunks'
--   );

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'voice_agents'
--   AND column_name IN ('require_customer_info', 'collect_bant_info');

-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'voice_agents',
--     'agent_conversations',
--     'agent_custom_fields',
--     'captured_leads',
--     'agent_knowledge_documents',
--     'agent_knowledge_chunks'
--   );


-- ============================================================================
-- Success notice
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Unified database setup completed successfully!';
  RAISE NOTICE '📦 Core tables: voice_agents, agent_conversations';
  RAISE NOTICE '📊 Lead tables: agent_custom_fields, captured_leads';
  RAISE NOTICE '🧠 Knowledge tables: agent_knowledge_documents, agent_knowledge_chunks';
  RAISE NOTICE '🔒 RLS policies, indexes, triggers, views, and functions are in place';
END $$;
