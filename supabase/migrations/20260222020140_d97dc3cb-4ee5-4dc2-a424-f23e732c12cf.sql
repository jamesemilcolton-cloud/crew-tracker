
-- Restore crew_name column
ALTER TABLE public.profiles ADD COLUMN crew_name text NOT NULL DEFAULT '';
