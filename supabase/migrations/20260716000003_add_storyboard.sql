-- Add storyboard JSONB column to scenes table for cinematic rendering instructions
ALTER TABLE public.scenes
ADD COLUMN storyboard JSONB;

COMMENT ON COLUMN public.scenes.storyboard IS 'AI-generated storyboard instructions: camera_movement, transition_in, transition_out, visual_effects, bgm_mood, zoom_intensity';
