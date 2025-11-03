-- Create table to store conversation history fetched from Hostaway
-- This provides context for AI responses by storing the full conversation thread
CREATE TABLE IF NOT EXISTS public.hostaway_conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  hostaway_message_id INTEGER NOT NULL,
  hostaway_conversation_id INTEGER NOT NULL,
  reservation_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  communication_type VARCHAR(50), -- email, channel, sms, whatsapp
  is_incoming BOOLEAN NOT NULL DEFAULT false,
  sent_date TIMESTAMP WITH TIME ZONE,
  inserted_on TIMESTAMP WITH TIME ZONE,
  message_hash VARCHAR(255), -- Hostaway message hash for deduplication
  metadata JSONB DEFAULT '{}'::jsonb, -- Store full Hostaway message object for reference
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure we don't duplicate messages
  UNIQUE(tenant_id, hostaway_message_id, hostaway_conversation_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hostaway_conversation_history_conversation_id 
  ON public.hostaway_conversation_history(conversation_id);

CREATE INDEX IF NOT EXISTS idx_hostaway_conversation_history_reservation_id 
  ON public.hostaway_conversation_history(reservation_id);

CREATE INDEX IF NOT EXISTS idx_hostaway_conversation_history_sent_date 
  ON public.hostaway_conversation_history(sent_date DESC);

CREATE INDEX IF NOT EXISTS idx_hostaway_conversation_history_hash 
  ON public.hostaway_conversation_history(message_hash) 
  WHERE message_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE public.hostaway_conversation_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own conversation history
CREATE POLICY "Tenants can view their own conversation history"
  ON public.hostaway_conversation_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants 
      WHERE id = (SELECT tenant_id FROM public.tenants WHERE id = hostaway_conversation_history.tenant_id)
    )
  );

CREATE POLICY "Service role can manage conversation history"
  ON public.hostaway_conversation_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.hostaway_conversation_history IS 'Stores full conversation history from Hostaway API to provide context for AI responses';
COMMENT ON COLUMN public.hostaway_conversation_history.is_incoming IS 'True if message is from guest, false if from host/AI';
COMMENT ON COLUMN public.hostaway_conversation_history.message_hash IS 'Hostaway message hash for deduplication';

