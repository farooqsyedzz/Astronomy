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
  // We DO NOT delete the old video record here, because QA reports are linked to the video_id.
  // Instead, we just trigger the render pipeline, and render.js will UPSERT the video file and update the existing DB record.
  await triggerRenderPipeline(topicId);
  redirect(`/dashboard/topics/${topicId}`);
}
