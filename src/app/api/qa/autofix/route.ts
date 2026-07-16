import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    
    const moduleId = formData.get('moduleId') as string;
    const autofixType = formData.get('type') as string;

    if (!moduleId || !autofixType) {
      return NextResponse.json({ error: 'Missing moduleId or type' }, { status: 400 });
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

    const { data: report } = await supabase
      .from('qa_reports')
      .select('video_id, videos(topic_id, topics(scripts(id)))')
      .eq('id', moduleRun.qa_report_id)
      .single();

    const topicId = (report as any)?.videos?.topic_id;
    const scriptId = (report as any)?.videos?.topics?.scripts?.[0]?.id;

    if (autofixType === 'image') {
      const sceneId = formData.get('sceneId') as string;
      const fixedPrompt = moduleRun.auto_fix.fixed_prompt;

      if (fixedPrompt && sceneId) {
        await supabase.from('scenes').update({ image_prompt: fixedPrompt }).eq('id', sceneId);
        await supabase.from('assets').delete().eq('scene_id', sceneId).eq('type', 'image');
      }
    } else if (autofixType === 'script') {
      const fixes = moduleRun.auto_fix.fixes;
      if (fixes && Array.isArray(fixes) && scriptId) {
        // Fetch all scenes for this script to modify them
        const { data: scenes } = await supabase
          .from('scenes')
          .select('*')
          .eq('script_id', scriptId)
          .order('order_index', { ascending: true });

        if (scenes) {
          const modifiedSceneIds = new Set<string>();

          // Apply each fix to the correct scene based on scene_order
          for (const fix of fixes) {
            const scene = scenes.find((s: any) => s.order_index === fix.scene_order);
            if (scene && fix.new_scene_narration) {
              scene.narration = fix.new_scene_narration;
              modifiedSceneIds.add(scene.id);
            }
          }

          // Update modified scenes in DB
          for (const sceneId of Array.from(modifiedSceneIds)) {
            const scene = scenes.find((s: any) => s.id === sceneId);
            if (scene) {
              await supabase.from('scenes').update({ narration: scene.narration }).eq('id', scene.id);
              // Delete voice asset so it regenerates
              await supabase.from('assets').delete().eq('scene_id', scene.id).eq('type', 'voice');
            }
          }

          // Rebuild master script text
          const newScriptText = scenes.map((s: any) => s.narration).join('\n\n');
          await supabase.from('scripts').update({ script_text: newScriptText }).eq('id', scriptId);
        }
      }
    }

    if (topicId) {
      return NextResponse.redirect(new URL(`/dashboard/topics/${topicId}/qa?success=autofix`, req.url), 303);
    }
    
    return NextResponse.json({ success: true, message: 'Auto-fix applied' });

  } catch (error) {
    console.error('Auto-fix Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
