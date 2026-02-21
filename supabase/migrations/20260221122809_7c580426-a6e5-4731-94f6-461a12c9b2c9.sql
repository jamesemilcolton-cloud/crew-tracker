
-- 1. Add unique constraint on phone in profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- 2. Create a function to handle auto-promotion when candidate reaches "promoted" stage
-- This checks if the candidate's leader is the manager; if not, auto-upgrades to leader
CREATE OR REPLACE FUNCTION public.handle_candidate_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _candidate_phone text;
  _candidate_user_id uuid;
  _candidate_profile_id uuid;
  _leader_profile_id uuid;
  _leader_is_manager boolean;
BEGIN
  -- Only trigger when stage changes TO 'promoted'
  IF NEW.stage = 'promoted' AND (OLD.stage IS NULL OR OLD.stage <> 'promoted') THEN
    -- Get candidate phone from candidates table
    _candidate_phone := NEW.phone;
    
    -- Find the profile linked to this candidate by phone
    SELECT id, user_id INTO _candidate_profile_id, _candidate_user_id
    FROM public.profiles
    WHERE phone = _candidate_phone
    LIMIT 1;
    
    -- Only proceed if this candidate has a linked user account
    IF _candidate_user_id IS NOT NULL THEN
      -- Get the leader_id from the candidate's profile
      SELECT leader_id INTO _leader_profile_id
      FROM public.profiles
      WHERE id = _candidate_profile_id;
      
      -- Check if the leader is a manager (super_admin)
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
      
      -- If leader is NOT the manager, auto-promote to leader
      IF NOT _leader_is_manager THEN
        UPDATE public.user_roles
        SET role = 'leader'
        WHERE user_id = _candidate_user_id
          AND role = 'brand_ambassador';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create trigger on candidates table for auto-promotion
CREATE TRIGGER trigger_candidate_promotion
AFTER UPDATE OF stage ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.handle_candidate_promotion();

-- 4. Create function to handle account deletion reassignment
-- When a user is banned/deleted, reassign their direct reports to their leader
CREATE OR REPLACE FUNCTION public.reassign_recruits_upward(_deleted_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_profile_id uuid;
  _parent_leader_id uuid;
BEGIN
  -- Get the deleted user's profile id and their leader
  SELECT id, leader_id INTO _deleted_profile_id, _parent_leader_id
  FROM public.profiles
  WHERE user_id = _deleted_user_id;
  
  IF _deleted_profile_id IS NOT NULL THEN
    -- Reassign all direct reports to the parent leader
    UPDATE public.profiles
    SET leader_id = _parent_leader_id
    WHERE leader_id = _deleted_profile_id;
    
    -- Also reassign candidates recruited by this user's profile to the parent leader
    UPDATE public.candidates
    SET recruited_by = _parent_leader_id
    WHERE recruited_by = _deleted_profile_id;
  END IF;
END;
$$;
