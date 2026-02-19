
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  leader_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's profile id
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: check if current user is leader of a given profile
CREATE OR REPLACE FUNCTION public.is_leader_of(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_id AND leader_id = public.get_my_profile_id()
  );
$$;

-- Profiles RLS
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read team profiles" ON public.profiles FOR SELECT USING (leader_id = public.get_my_profile_id());
CREATE POLICY "Anyone authenticated reads all profiles for org tree" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'LinkedIn' CHECK (source IN ('LinkedIn', 'Office')),
  stage TEXT NOT NULL DEFAULT '2nd-round',
  status TEXT CHECK (status IN ('Offered', 'Declined', 'Dropped')),
  potential_start_date DATE,
  has_sales_pitch_access BOOLEAN NOT NULL DEFAULT false,
  has_evo_app_access BOOLEAN NOT NULL DEFAULT false,
  recruited_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own candidates" ON public.candidates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "All authenticated read candidates for org tree" ON public.candidates FOR SELECT TO authenticated USING (true);

-- Stage history
CREATE TABLE public.candidate_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own candidate history" ON public.candidate_stage_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_id AND candidates.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_id AND candidates.user_id = auth.uid()));
CREATE POLICY "All authenticated read history for org" ON public.candidate_stage_history FOR SELECT TO authenticated USING (true);

-- Ad uploads
CREATE TABLE public.ad_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ad_type TEXT NOT NULL CHECK (ad_type IN ('free', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ads" ON public.ad_uploads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "All authenticated read ads for leaderboard" ON public.ad_uploads FOR SELECT TO authenticated USING (true);

-- CV downloads (attributed to ad uploads)
CREATE TABLE public.cv_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_upload_id UUID NOT NULL REFERENCES public.ad_uploads(id) ON DELETE CASCADE,
  download_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cv downloads" ON public.cv_downloads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "All authenticated read cvs for leaderboard" ON public.cv_downloads FOR SELECT TO authenticated USING (true);

-- LinkedIn daily activity
CREATE TABLE public.linkedin_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  free_ads_uploaded INTEGER NOT NULL DEFAULT 0,
  paid_ads_uploaded INTEGER NOT NULL DEFAULT 0,
  cvs_downloaded INTEGER NOT NULL DEFAULT 0,
  candidates_attending_2nd_round INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

ALTER TABLE public.linkedin_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own linkedin activity" ON public.linkedin_activity FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "All authenticated read linkedin for leaderboard" ON public.linkedin_activity FOR SELECT TO authenticated USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
