-- Add script_text column to scripts table
ALTER TABLE public.scripts
ADD COLUMN script_text TEXT;
