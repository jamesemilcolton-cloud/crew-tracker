CREATE POLICY "All authenticated read outreach for manager"
ON public.linkedin_outreach
FOR SELECT
TO authenticated
USING (true);