-- Add scene_count to topics table
ALTER TABLE public.topics ADD COLUMN scene_count INTEGER DEFAULT 10;
