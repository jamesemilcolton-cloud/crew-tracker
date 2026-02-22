
-- Create sales_transactions table for per-sale financial records
CREATE TABLE public.sales_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  week_start date NOT NULL,
  age_band text NOT NULL CHECK (age_band IN ('30-35', '36-44', '45+')),
  ask_amount numeric NOT NULL,
  isa_upfront numeric NOT NULL DEFAULT 0,
  owner_upfront numeric NOT NULL DEFAULT 0,
  total_wire numeric NOT NULL DEFAULT 0,
  quality_pending numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own transactions
CREATE POLICY "Users insert own transactions"
  ON public.sales_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own transactions
CREATE POLICY "Users view own transactions"
  ON public.sales_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own transactions
CREATE POLICY "Users delete own transactions"
  ON public.sales_transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- All authenticated users can read all transactions (for leaderboard/crew views)
CREATE POLICY "All authenticated read transactions for leaderboard"
  ON public.sales_transactions
  FOR SELECT
  USING (true);

-- Index for common query patterns
CREATE INDEX idx_sales_transactions_user_week ON public.sales_transactions (user_id, week_start);
CREATE INDEX idx_sales_transactions_date ON public.sales_transactions (date);
