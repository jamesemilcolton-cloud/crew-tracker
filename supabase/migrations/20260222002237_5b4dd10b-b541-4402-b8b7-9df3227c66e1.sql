
-- Drop any existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_candidate_stage_change ON public.candidates;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_candidates_updated_at ON public.candidates;
DROP TRIGGER IF EXISTS update_sales_entries_updated_at ON public.sales_entries;

-- 1. Auto-create user_roles entry when a profile is inserted
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 2. Auto-promote candidate when stage changes to 'promoted'
CREATE TRIGGER on_candidate_stage_change
  AFTER UPDATE ON public.candidates
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.handle_candidate_promotion();

-- 3. Auto-update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_entries_updated_at
  BEFORE UPDATE ON public.sales_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
