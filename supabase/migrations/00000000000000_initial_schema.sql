-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create channels table
CREATE TABLE public.channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create topics table
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create research table
CREATE TABLE public.research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create scripts table
CREATE TABLE public.scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    chapters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create scenes table
CREATE TABLE public.scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
    narration TEXT NOT NULL,
    duration INTEGER NOT NULL, -- duration in seconds or milliseconds
    image_prompt TEXT,
    animation_type TEXT,
    order_index INTEGER NOT NULL
);

-- 6. Create assets table
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'image', 'voice', 'caption'
    file_url TEXT,
    status TEXT DEFAULT 'pending'
);

-- 7. Create jobs table (for background processing)
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Running', 'Completed', 'Failed'
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create renders / videos table
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    final_video_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create analytics table
CREATE TABLE public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create settings table
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    youtube_api_key TEXT,
    voice_provider TEXT DEFAULT 'edge_tts',
    default_language TEXT DEFAULT 'en',
    UNIQUE(user_id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create Policies (Basic Example: Users can only see/modify their own data based on channel_id/user_id)
-- Note: You should expand these policies for production.

CREATE POLICY "Users can manage their own channels" ON public.channels
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own settings" ON public.settings
    FOR ALL USING (auth.uid() = user_id);
