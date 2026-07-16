-- Migration: Quality Engine and Thumbnails

-- 1. Add readiness_score to topics
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS readiness_score INTEGER;

-- 2. Create producer_reviews table
CREATE TABLE IF NOT EXISTS public.producer_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    hook_score INTEGER,
    storytelling_score INTEGER,
    accuracy_score INTEGER,
    retention_score INTEGER,
    seo_score INTEGER,
    overall_score INTEGER,
    feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create thumbnails table
CREATE TABLE IF NOT EXISTS public.thumbnails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    concept_title TEXT,
    image_prompt TEXT,
    overlay_text TEXT,
    text_position TEXT,
    font_size INTEGER,
    font_color TEXT,
    stroke_color TEXT,
    estimated_ctr INTEGER,
    file_url TEXT,
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.producer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thumbnails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage producer reviews" ON public.producer_reviews FOR ALL USING (true);
CREATE POLICY "Users can manage thumbnails" ON public.thumbnails FOR ALL USING (true);
