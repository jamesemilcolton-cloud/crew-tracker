
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('brand_ambassador', 'leader', 'manager');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'brand_ambassador',
  super_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Security definer function to check super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'manager'
      AND super_admin = true
  )
$$;

-- 6. Function to get user role (for AuthContext)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'role', role::text,
    'super_admin', super_admin
  )
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 7. RLS policies for user_roles
-- Everyone authenticated can read roles (needed for leader dropdown etc)
CREATE POLICY "Authenticated users can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Only super_admin can insert/update/delete roles
CREATE POLICY "Super admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Users can read their own role
CREATE POLICY "Users read own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 8. Add phone column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

-- 9. Auto-create default role on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, super_admin)
  VALUES (NEW.user_id, 'brand_ambassador', false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_add_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();

-- 10. Assign James Colton as manager + super_admin
INSERT INTO public.user_roles (user_id, role, super_admin)
VALUES ('e46902df-509f-4978-b5a2-f48db2224d17', 'manager', true);

-- 11. Edge function for manager to disable user accounts (ban)
-- We'll handle this via edge function since we can't modify auth schema directly
