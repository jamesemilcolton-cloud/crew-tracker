
-- Create sales_entries table for daily gauge data
CREATE TABLE public.sales_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  doors integer NOT NULL DEFAULT 0,
  spoken integer NOT NULL DEFAULT 0,
  presentations integer NOT NULL DEFAULT 0,
  closes integer NOT NULL DEFAULT 0,
  tablets integer NOT NULL DEFAULT 0,
  sales integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

-- Enable RLS
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;

-- Users can read all entries (needed for leader/manager team views)
CREATE POLICY "All authenticated read sales entries"
ON public.sales_entries
FOR SELECT
TO authenticated
USING (true);

-- Users manage own entries
CREATE POLICY "Users manage own sales entries"
ON public.sales_entries
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sales_entries_updated_at
BEFORE UPDATE ON public.sales_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
