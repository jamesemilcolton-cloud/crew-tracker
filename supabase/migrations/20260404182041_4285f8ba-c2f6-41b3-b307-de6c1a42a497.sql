
CREATE TABLE public.linkedin_outreach (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent INT NOT NULL DEFAULT 0,
  replies INT NOT NULL DEFAULT 0,
  interviews INT NOT NULL DEFAULT 0,
  activity_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_date)
);

ALTER TABLE public.linkedin_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outreach data"
  ON public.linkedin_outreach FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outreach data"
  ON public.linkedin_outreach FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outreach data"
  ON public.linkedin_outreach FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
