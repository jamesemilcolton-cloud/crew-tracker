
CREATE TABLE public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE UNIQUE INDEX idx_invite_tokens_candidate_active ON public.invite_tokens (candidate_id) WHERE used = false;

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read invite tokens"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Leaders and managers insert invite tokens"
  ON public.invite_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System updates invite tokens"
  ON public.invite_tokens FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Anon read invite tokens for signup"
  ON public.invite_tokens FOR SELECT TO anon
  USING (used = false);
