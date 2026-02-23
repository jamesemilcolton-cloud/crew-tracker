-- Drop the unique constraint on phone since managers use email as their ID
-- and may share phone numbers with other accounts
ALTER TABLE public.profiles DROP CONSTRAINT profiles_phone_unique;