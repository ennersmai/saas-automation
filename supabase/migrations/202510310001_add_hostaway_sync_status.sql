-- Add sync status tracking for Hostaway integration
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS hostaway_sync_status VARCHAR(20) DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS hostaway_last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hostaway_sync_error TEXT;

-- Add index for querying tenants that need sync
CREATE INDEX IF NOT EXISTS idx_tenants_hostaway_sync_status 
ON public.tenants(hostaway_sync_status) 
WHERE hostaway_sync_status IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.tenants.hostaway_sync_status IS 'Status of Hostaway sync: idle, syncing, completed, failed';
COMMENT ON COLUMN public.tenants.hostaway_last_sync_at IS 'Timestamp of last successful sync completion';
COMMENT ON COLUMN public.tenants.hostaway_sync_error IS 'Error message if last sync failed';

