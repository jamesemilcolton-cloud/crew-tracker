
-- Make the trigger idempotent so it won't fail on duplicate role rows
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role, super_admin)
  VALUES (NEW.user_id, 'brand_ambassador', false)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;
