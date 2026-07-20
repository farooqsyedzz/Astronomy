-- Migration: Add profiles to topics
ALTER TABLE topics
ADD COLUMN voice_profile TEXT DEFAULT 'YouTube',
ADD COLUMN video_style TEXT DEFAULT 'Cinematic',
ADD COLUMN retention_level TEXT DEFAULT 'Balanced',
ADD COLUMN voice_settings JSONB,
ADD COLUMN video_settings JSONB;
