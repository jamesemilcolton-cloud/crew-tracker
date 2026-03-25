
ALTER TABLE public.ad_uploads
  ADD COLUMN title_number integer NOT NULL DEFAULT 1,
  ADD COLUMN ad_number integer NOT NULL DEFAULT 1;
