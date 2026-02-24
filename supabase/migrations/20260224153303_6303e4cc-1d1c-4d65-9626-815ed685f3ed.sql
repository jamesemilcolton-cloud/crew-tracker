
-- 1. Create the promotion_queue table
CREATE TABLE public.promotion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  leader_profile_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.promotion_queue ENABLE ROW LEVEL SECURITY;

-- Managers can read/manage all queue entries
CREATE POLICY "Super admins manage promotion queue"
ON public.promotion_queue
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- All authenticated can read queue (for lock checks)
CREATE POLICY "All authenticated read promotion queue"
ON public.promotion_queue
FOR SELECT
USING (true);

-- 2. Create personal_best_log table for tracking PB achievements
CREATE TABLE public.personal_best_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  week_start date NOT NULL,
  weekly_sales integer NOT NULL,
  rep_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  displayed boolean NOT NULL DEFAULT false
);

ALTER TABLE public.personal_best_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage personal best log"
ON public.personal_best_log
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "All authenticated read personal best log"
ON public.personal_best_log
FOR SELECT
USING (true);

-- 3. Replace the handle_candidate_promotion trigger function
-- Now it inserts into promotion_queue instead of auto-promoting
CREATE OR REPLACE FUNCTION public.handle_candidate_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _candidate_phone text;
  _candidate_user_id uuid;
  _candidate_profile_id uuid;
  _leader_profile_id uuid;
  _leader_is_manager boolean;
  _already_queued boolean;
BEGIN
  -- Only trigger when stage changes TO 'promoted'
  IF NEW.stage = 'promoted' AND (OLD.stage IS NULL OR OLD.stage <> 'promoted') THEN
    _candidate_phone := NEW.phone;
    
    SELECT id, user_id INTO _candidate_profile_id, _candidate_user_id
    FROM public.profiles
    WHERE phone = _candidate_phone
    LIMIT 1;
    
    IF _candidate_user_id IS NOT NULL THEN
      SELECT leader_id INTO _leader_profile_id
      FROM public.profiles
      WHERE id = _candidate_profile_id;
      
      IF _leader_profile_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.profiles p ON p.user_id = ur.user_id
          WHERE p.id = _leader_profile_id
            AND ur.role = 'manager'
            AND ur.super_admin = true
        ) INTO _leader_is_manager;
      ELSE
        _leader_is_manager := false;
      END IF;
      
      -- Check if already queued (pending)
      SELECT EXISTS (
        SELECT 1 FROM public.promotion_queue
        WHERE profile_id = _candidate_profile_id AND status = 'pending'
      ) INTO _already_queued;
      
      IF NOT _leader_is_manager AND NOT _already_queued THEN
        -- Insert into queue instead of auto-promoting
        INSERT INTO public.promotion_queue (candidate_id, user_id, profile_id, leader_profile_id, status)
        VALUES (NEW.id, _candidate_user_id, _candidate_profile_id, _leader_profile_id, 'pending');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
