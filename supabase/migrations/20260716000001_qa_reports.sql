-- Migration: Create QA Reports tables

-- 1. Create qa_reports table
CREATE TABLE public.qa_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    overall_score INTEGER,
    confidence INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    decision TEXT, -- 'APPROVED', 'MINOR_IMPROVEMENTS', 'REGENERATE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create qa_module_runs table
CREATE TABLE public.qa_module_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qa_report_id UUID REFERENCES public.qa_reports(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL, -- 'topic', 'script', 'scenes', 'images', 'thumbnail', 'seo'
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
    score INTEGER,
    confidence INTEGER,
    issues JSONB,
    recommendations JSONB,
    auto_fix JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_module_runs ENABLE ROW LEVEL SECURITY;

-- Note: Policies can be expanded based on channel_id/user_id in production.
-- For now, allow authenticated users to manage QA reports
CREATE POLICY "Users can manage QA reports" ON public.qa_reports
    FOR ALL USING (true);

CREATE POLICY "Users can manage QA module runs" ON public.qa_module_runs
    FOR ALL USING (true);
