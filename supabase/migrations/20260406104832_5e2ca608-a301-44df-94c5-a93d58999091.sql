
CREATE TABLE public.office_starts_read (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reader_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, user_id)
);

ALTER TABLE public.office_starts_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read office starts read"
  ON public.office_starts_read FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users insert own office starts read"
  ON public.office_starts_read FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
