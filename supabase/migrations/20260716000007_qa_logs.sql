CREATE TABLE public.qa_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    content JSONB,
    reason TEXT,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
