
-- Add first_name and last_name columns to candidates
ALTER TABLE public.candidates ADD COLUMN first_name text NOT NULL DEFAULT '';
ALTER TABLE public.candidates ADD COLUMN last_name text NOT NULL DEFAULT '';

-- Populate from existing name field (split on first space)
UPDATE public.candidates
SET first_name = CASE
    WHEN position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END;
