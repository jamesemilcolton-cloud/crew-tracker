
CREATE TABLE public.personal_recruitment_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  contact_type text NOT NULL,
  people_spoken_to integer NOT NULL DEFAULT 0,
  invited_to_ob integer NOT NULL DEFAULT 0,
  attended_ob integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_recruitment_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal activity" ON public.personal_recruitment_activity
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All authenticated read personal activity" ON public.personal_recruitment_activity
  FOR SELECT USING (true);
