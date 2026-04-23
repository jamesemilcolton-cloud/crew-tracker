-- Pipeline rename: drop bottom_line stage, map any existing data forward to "final"
UPDATE public.candidates SET stage = 'final' WHERE stage = 'bottom_line';

-- Update any historical references to bottom_line: redirect transitions to/from it onto 'final'
UPDATE public.candidate_stage_history SET to_stage = 'final' WHERE to_stage = 'bottom_line';
UPDATE public.candidate_stage_history SET from_stage = 'final' WHERE from_stage = 'bottom_line';

-- Remove redundant self-transitions created by the remap
DELETE FROM public.candidate_stage_history WHERE from_stage = to_stage;