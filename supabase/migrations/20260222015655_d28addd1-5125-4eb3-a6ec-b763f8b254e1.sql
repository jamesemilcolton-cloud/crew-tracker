
-- Add first_name and last_name columns
ALTER TABLE public.profiles ADD COLUMN first_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN last_name text NOT NULL DEFAULT '';

-- Migrate existing full_name data into first_name / last_name
UPDATE public.profiles SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END;

-- Drop crew_name column
ALTER TABLE public.profiles DROP COLUMN crew_name;
