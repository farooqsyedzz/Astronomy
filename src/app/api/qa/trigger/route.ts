import { NextRequest, NextResponse } from 'next/server';
import { runQAPipeline } from '@/services/qa/pipeline';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const topicId = formData.get('topicId') as string;
    const videoId = formData.get('videoId') as string;

    if (!topicId || !videoId) {
      return NextResponse.json({ error: 'Missing topicId or videoId' }, { status: 400 });
    }

    // Fire and forget - don't await so the UI updates immediately to "Running" state
    runQAPipeline(topicId, videoId).catch(err => console.error('QA Pipeline error:', err));

    // Revalidate the QA page so it shows the new pending/running report
    revalidatePath(`/dashboard/topics/${topicId}/qa`);
    
    // Redirect back to the QA dashboard
    return NextResponse.redirect(new URL(`/dashboard/topics/${topicId}/qa`, req.url), 303);

  } catch (error) {
    console.error('Trigger QA Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
