
-- Add weekly email preference to profiles
ALTER TABLE public.profiles
ADD COLUMN weekly_email_enabled boolean NOT NULL DEFAULT true;
