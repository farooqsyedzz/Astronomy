import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    
    const moduleId = formData.get('moduleId') as string;
    const sceneId = formData.get('sceneId') as string;

    if (!moduleId || !sceneId) {
      return NextResponse.json({ error: 'Missing moduleId or sceneId' }, { status: 400 });
    }

    // 1. Fetch the module run to get the auto_fix data
    const { data: moduleRun } = await supabase
      .from('qa_module_runs')
      .select('auto_fix, qa_report_id')
      .eq('id', moduleId)
      .single();

    if (!moduleRun || !moduleRun.auto_fix) {
      return NextResponse.json({ error: 'No auto-fix data found' }, { status: 404 });
    }

    const fixedPrompt = moduleRun.auto_fix.fixed_prompt;

    if (fixedPrompt) {
      // 2. Update the scene in the database with the fixed prompt
      await supabase
        .from('scenes')
        .update({ image_prompt: fixedPrompt })
        .eq('id', sceneId);
      
      // 3. Delete the old image asset so partial regeneration works
      await supabase
        .from('assets')
        .delete()
        .eq('scene_id', sceneId)
        .eq('type', 'image');
    }

    // 4. Redirect back to the QA page
    // We need the topic ID to redirect properly. We can get it from the report.
    const { data: report } = await supabase
      .from('qa_reports')
      .select('video_id, videos(topic_id)')
      .eq('id', moduleRun.qa_report_id)
      .single();

    const topicId = (report as any)?.videos?.topic_id;
    if (topicId) {
      return NextResponse.redirect(new URL(`/dashboard/topics/${topicId}/qa`, req.url), 303);
    }
    
    return NextResponse.json({ success: true, message: 'Auto-fix applied' });

  } catch (error) {
    console.error('Auto-fix Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
