
CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Managers can read/manage all tokens
CREATE POLICY "Super admins manage reset tokens"
ON public.password_reset_tokens
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Anon can read unused tokens for the reset page
CREATE POLICY "Anon read unused reset tokens"
ON public.password_reset_tokens
FOR SELECT
TO anon
USING (used = false);
