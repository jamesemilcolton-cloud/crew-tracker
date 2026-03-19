
-- LinkedIn titles library (10 slots, owner-editable)
CREATE TABLE public.linkedin_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number integer NOT NULL UNIQUE CHECK (slot_number >= 1 AND slot_number <= 10),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.linkedin_titles ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "All authenticated read linkedin titles"
  ON public.linkedin_titles FOR SELECT TO authenticated
  USING (true);

-- Only super admins (owners) can modify
CREATE POLICY "Super admins manage linkedin titles"
  ON public.linkedin_titles FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- LinkedIn ads library (10 slots, owner-editable)
CREATE TABLE public.linkedin_ads_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number integer NOT NULL UNIQUE CHECK (slot_number >= 1 AND slot_number <= 10),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.linkedin_ads_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read linkedin ads library"
  ON public.linkedin_ads_library FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins manage linkedin ads library"
  ON public.linkedin_ads_library FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Active LinkedIn ads tracker
CREATE TABLE public.active_linkedin_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title_number integer NOT NULL,
  ad_number integer NOT NULL,
  ad_type text NOT NULL DEFAULT 'free',
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.active_linkedin_ads ENABLE ROW LEVEL SECURITY;

-- Everyone can read active ads
CREATE POLICY "All authenticated read active linkedin ads"
  ON public.active_linkedin_ads FOR SELECT TO authenticated
  USING (true);

-- Users manage their own active ads
CREATE POLICY "Users manage own active linkedin ads"
  ON public.active_linkedin_ads FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed the 10 title slots
INSERT INTO public.linkedin_titles (slot_number) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);

-- Seed the 10 ad slots
INSERT INTO public.linkedin_ads_library (slot_number) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);
