-- Add sentences_per_scene to topics table
ALTER TABLE public.topics ADD COLUMN sentences_per_scene TEXT DEFAULT '2-3';
