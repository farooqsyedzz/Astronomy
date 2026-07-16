'use server';

import { createClient } from '@/lib/supabase/server';
import { generateScriptAndScenes } from '@/features/scripts/actions';
import { generateAssets } from '@/features/assets/actions';
import { triggerRenderPipeline } from '@/features/render/actions';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { generateScenes } from '@/services/ai';

export async function regenerateScriptAction(topicId: string) {
  const supabase = await createClient();

  // 1. Delete the old script (this will cascade delete scenes and assets)
  await supabase
    .from('scripts')
    .delete()
    .eq('topic_id', topicId);

  // 2. Generate new script and scenes
  await generateScriptAndScenes(topicId);
  // generateScriptAndScenes handles the redirect
}

export async function regenerateScenesAction(topicId: string) {
  const supabase = await createClient();

  // 1. Fetch the existing script text
  const { data: topic } = await supabase
    .from('topics')
    .select('*, scripts(*)')
    .eq('id', topicId)
    .single();

  const script = topic?.scripts?.[0];
  if (!script) {
    throw new Error('No script available to generate scenes from');
  }

  let scriptTextToUse = script.script_text;

  // Fallback for legacy topics created before script_text column existed
  if (!scriptTextToUse) {
    console.log("Legacy topic detected: reconstructing script_text from existing scenes...");
    const { data: oldScenes } = await supabase
      .from('scenes')
      .select('narration')
      .eq('script_id', script.id)
      .order('order_index', { ascending: true });
    
    if (oldScenes && oldScenes.length > 0) {
      scriptTextToUse = oldScenes.map((s: any) => s.narration).join('\n\n');
      
      // Optionally update the DB with this reconstructed text
      await supabase
        .from('scripts')
        .update({ script_text: scriptTextToUse })
        .eq('id', script.id);
    } else {
      throw new Error('No script text and no old scenes available. Please use "Regenerate Script" instead.');
    }
  }

  // 2. Delete existing scenes (this will cascade delete assets)
  await supabase
    .from('scenes')
    .delete()
    .eq('script_id', script.id);

  // 3. Generate new scenes
  const scenesData = await generateScenes(scriptTextToUse);

  const sceneInserts = scenesData.map((scene: any, index: number) => ({
    script_id: script.id,
    narration: scene.narration,
    duration: scene.duration,
    image_prompt: scene.imagePrompt,
    animation_type: scene.animationType,
    order_index: index,
  }));

  const { error: scenesError } = await supabase
    .from('scenes')
    .insert(sceneInserts);

  if (scenesError) throw scenesError;

  // 4. Update Topic Status
  await supabase
    .from('topics')
    .update({ status: 'scenes_planned' })
    .eq('id', topicId);

  revalidatePath(`/dashboard/topics/${topicId}/qa`);
  redirect(`/dashboard/topics/${topicId}`);
}

export async function regenerateMissingAssetsAction(topicId: string) {
  // generateAssets automatically checks for existing assets and skips them
  await generateAssets(topicId);
  // generateAssets calls revalidatePath, but we want to stay on the QA page or go to topic
  redirect(`/dashboard/topics/${topicId}`);
}

export async function reRenderVideoAction(topicId: string) {
  // 1. Automatically generate any missing assets (e.g., if an asset was deleted by auto-fix)
  await generateAssets(topicId);

  // 2. Trigger the render pipeline
  await triggerRenderPipeline(topicId);
  redirect(`/dashboard/topics/${topicId}`);
}

export async function applyImageFixAction(moduleId: string, sceneOrder: number) {
  const supabase = await createClient();
  const { data: moduleRun } = await supabase.from('qa_module_runs').select('auto_fix, qa_report_id').eq('id', moduleId).single();
  if (!moduleRun?.auto_fix?.fixed_prompt) throw new Error('No auto-fix available');

  const { data: report } = await supabase.from('qa_reports').select('video_id, videos(topic_id)').eq('id', moduleRun.qa_report_id).single();
  const topicId = (report as any)?.videos?.topic_id;
  if (!topicId) throw new Error('Topic not found');

  const { data: topic } = await supabase.from('topics').select('scripts(id)').eq('id', topicId).single();
  const scriptId = topic?.scripts?.[0]?.id;
  if (!scriptId) throw new Error('Script not found');

  const { data: sceneData } = await supabase.from('scenes').select('id').eq('script_id', scriptId).eq('order_index', sceneOrder).single();
  if (sceneData) {
    await supabase.from('scenes').update({ image_prompt: moduleRun.auto_fix.fixed_prompt }).eq('id', sceneData.id);
    await supabase.from('assets').delete().eq('scene_id', sceneData.id).eq('type', 'image');
  }

  await supabase.from('qa_reports').delete().eq('id', moduleRun.qa_report_id);
  revalidatePath(`/dashboard/topics/${topicId}`);
  revalidatePath(`/dashboard/topics/${topicId}/qa`);
  redirect(`/dashboard/topics/${topicId}/qa?success=autofix`);
}

export async function applyScriptFixesAction(moduleId: string) {
  const supabase = await createClient();
  const { data: moduleRun } = await supabase.from('qa_module_runs').select('auto_fix, qa_report_id').eq('id', moduleId).single();
  const fixes = moduleRun?.auto_fix?.fixes;
  if (!fixes || !Array.isArray(fixes)) throw new Error('No fixes available');

  const { data: report } = await supabase.from('qa_reports').select('video_id, videos(topic_id)').eq('id', moduleRun.qa_report_id).single();
  const topicId = (report as any)?.videos?.topic_id;
  if (!topicId) throw new Error('Topic not found');

  const { data: topic } = await supabase.from('topics').select('scripts(id)').eq('id', topicId).single();
  const scriptId = topic?.scripts?.[0]?.id;
  if (!scriptId) throw new Error('Script not found');

  const { data: scenes } = await supabase.from('scenes').select('*').eq('script_id', scriptId).order('order_index', { ascending: true });
  if (scenes) {
    const modifiedSceneIds = new Set<string>();
    for (const fix of fixes) {
      const scene = scenes.find((s: any) => s.order_index === Number(fix.scene_order ?? fix.scene_id));
      if (scene && fix.new_scene_narration) {
        scene.narration = fix.new_scene_narration;
        modifiedSceneIds.add(scene.id);
      }
    }

    for (const sceneId of Array.from(modifiedSceneIds)) {
      const scene = scenes.find((s: any) => s.id === sceneId);
      if (scene) {
        await supabase.from('scenes').update({ narration: scene.narration }).eq('id', scene.id);
        await supabase.from('assets').delete().eq('scene_id', scene.id).eq('type', 'voice');
      }
    }

    const newScriptText = scenes.map((s: any) => s.narration).join('\n\n');
    await supabase.from('scripts').update({ script_text: newScriptText }).eq('id', scriptId);
  }

  await supabase.from('qa_reports').delete().eq('id', moduleRun.qa_report_id);
  revalidatePath(`/dashboard/topics/${topicId}`);
  revalidatePath(`/dashboard/topics/${topicId}/qa`);
  redirect(`/dashboard/topics/${topicId}/qa?success=autofix`);
}
