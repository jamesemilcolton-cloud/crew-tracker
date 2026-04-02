
-- 1. ID generation functions
CREATE OR REPLACE FUNCTION public.generate_candidate_id() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id text; exists_already boolean;
BEGIN
  LOOP
    new_id := 'CAND-' || upper(substr(md5(random()::text), 1, 7));
    SELECT EXISTS(SELECT 1 FROM candidates WHERE candidate_id = new_id) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_user_code() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_code text; exists_already boolean;
BEGIN
  LOOP
    new_code := 'USR-' || upper(substr(md5(random()::text), 1, 7));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE user_code = new_code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_code;
END;
$$;

-- 2. Add new columns
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS candidate_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS candidate_record_id uuid;

-- 3. Populate candidate IDs for existing candidates
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM candidates WHERE candidate_id IS NULL LOOP
    UPDATE candidates SET candidate_id = public.generate_candidate_id() WHERE id = r.id;
  END LOOP;
END;
$$;

-- 4. Populate user codes for existing profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE user_code IS NULL LOOP
    UPDATE profiles SET user_code = public.generate_user_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Populate usernames for existing users
UPDATE profiles SET username = 'jamesmanager' WHERE user_id = 'e46902df-509f-4978-b5a2-f48db2224d17';
UPDATE profiles SET username = 'james' WHERE user_id = 'd22bbbbc-33a5-4bd2-8ba6-9919470ce3b8';
UPDATE profiles SET username = 'grace' WHERE user_id = '5168f380-2f3c-4485-8159-d4a7151fc631';
UPDATE profiles SET username = 'luke' WHERE user_id = '94756c0e-71d6-4431-adbb-1b9581b031b6';
UPDATE profiles SET username = 'ore' WHERE user_id = '311a58f0-a561-4684-b8b8-73435559fe84';
UPDATE profiles SET username = 'tiarnan' WHERE user_id = 'f7810721-8f0a-438a-a8ae-d26c5fa9b78a';

-- 6. Link profiles to candidates via phone before dropping phone
UPDATE profiles p SET candidate_record_id = (
  SELECT c.id FROM candidates c WHERE c.phone = p.phone AND c.archived_at IS NULL LIMIT 1
) WHERE p.phone IS NOT NULL AND p.phone != '' AND p.candidate_record_id IS NULL;

-- 7. Add NOT NULL and unique constraints
ALTER TABLE candidates ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE candidates ADD CONSTRAINT candidates_candidate_id_unique UNIQUE (candidate_id);
ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
ALTER TABLE profiles ALTER COLUMN user_code SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_code_unique UNIQUE (user_code);

-- 8. Auto-generation trigger for candidate_id
CREATE OR REPLACE FUNCTION public.set_candidate_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.candidate_id IS NULL OR NEW.candidate_id = '' THEN
    NEW.candidate_id := public.generate_candidate_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_candidate_id_trigger ON candidates;
CREATE TRIGGER set_candidate_id_trigger
  BEFORE INSERT ON candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_candidate_id();

-- 9. Auto-generation trigger for user_code
CREATE OR REPLACE FUNCTION public.set_user_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_code IS NULL OR NEW.user_code = '' THEN
    NEW.user_code := public.generate_user_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_code_trigger ON profiles;
CREATE TRIGGER set_user_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_user_code();

-- 10. Update handle_candidate_promotion to use candidate_record_id instead of phone
CREATE OR REPLACE FUNCTION public.handle_candidate_promotion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _candidate_profile_id uuid;
  _candidate_user_id uuid;
  _leader_profile_id uuid;
  _leader_is_manager boolean;
  _already_queued boolean;
BEGIN
  IF NEW.stage = 'promoted' AND (OLD.stage IS NULL OR OLD.stage <> 'promoted') THEN
    SELECT id, user_id INTO _candidate_profile_id, _candidate_user_id
    FROM public.profiles WHERE candidate_record_id = NEW.id LIMIT 1;

    IF _candidate_user_id IS NOT NULL THEN
      SELECT leader_id INTO _leader_profile_id FROM public.profiles WHERE id = _candidate_profile_id;

      IF _leader_profile_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.user_id = ur.user_id
          WHERE p.id = _leader_profile_id AND ur.role = 'manager' AND ur.super_admin = true
        ) INTO _leader_is_manager;
      ELSE
        _leader_is_manager := false;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.promotion_queue WHERE profile_id = _candidate_profile_id AND status = 'pending'
      ) INTO _already_queued;

      IF NOT _leader_is_manager AND NOT _already_queued THEN
        INSERT INTO public.promotion_queue (candidate_id, user_id, profile_id, leader_profile_id, status)
        VALUES (NEW.id, _candidate_user_id, _candidate_profile_id, _leader_profile_id, 'pending');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_candidate_promoted ON candidates;
CREATE TRIGGER on_candidate_promoted
  AFTER UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION public.handle_candidate_promotion();

-- 11. Drop phone column from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS phone;
