
-- Add archived_at column for soft-delete
ALTER TABLE public.candidates ADD COLUMN archived_at timestamp with time zone DEFAULT NULL;

-- Migrate candidate stages to new simplified pipeline
UPDATE public.candidates SET stage = 'obs' WHERE stage = '2nd-round';
UPDATE public.candidates SET stage = 'final' WHERE stage = 'final-round';
UPDATE public.candidates SET stage = 'offered' WHERE stage IN ('rehash', 'sunday-call');
-- 'start' stays 'start'
UPDATE public.candidates SET stage = 'solo' WHERE stage = 'bell';
-- 'promoted' stays 'promoted'

-- Migrate history stages
UPDATE public.candidate_stage_history SET from_stage = 'obs' WHERE from_stage = '2nd-round';
UPDATE public.candidate_stage_history SET to_stage = 'obs' WHERE to_stage = '2nd-round';
UPDATE public.candidate_stage_history SET from_stage = 'final' WHERE from_stage = 'final-round';
UPDATE public.candidate_stage_history SET to_stage = 'final' WHERE to_stage = 'final-round';
UPDATE public.candidate_stage_history SET from_stage = 'offered' WHERE from_stage IN ('rehash', 'sunday-call');
UPDATE public.candidate_stage_history SET to_stage = 'offered' WHERE to_stage IN ('rehash', 'sunday-call');
UPDATE public.candidate_stage_history SET from_stage = 'solo' WHERE from_stage = 'bell';
UPDATE public.candidate_stage_history SET to_stage = 'solo' WHERE to_stage = 'bell';

-- Update default stage for new candidates
ALTER TABLE public.candidates ALTER COLUMN stage SET DEFAULT 'obs';
