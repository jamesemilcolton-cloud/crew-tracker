
-- Add drop-off fields to candidates table
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS drop_off_reason text,
ADD COLUMN IF NOT EXISTS drop_off_date timestamp with time zone;
