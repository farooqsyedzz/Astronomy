'use server';

import { createClient } from '@/lib/supabase/server';
import { generateScript, generateScenes } from '@/services/ai';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function generateScriptAndScenes(topicId: string) {
  const supabase = await createClient();

  // 1. Fetch Research
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*, research(content)')
    .eq('id', topicId)
    .single();

  if (topicError || !topic || !topic.research || topic.research.length === 0) {
    throw new Error('Could not find research for this topic');
  }

  const researchContent = topic.research[0].content;
  const targetSceneCount = topic.scene_count || 10;
  const sentencesPerScene = topic.sentences_per_scene || '2-3';

  try {
    // 2. Generate Script & Scenes together (Optimized 1 API Call)
    const scriptData = await generateScript(researchContent, targetSceneCount, sentencesPerScene);

    // 3. Reconstruct scriptText
    const scriptText = scriptData.scenes.map((s: any) => s.narration).join('\n\n');

    // 4. Insert Script
    const { data: insertedScript, error: scriptError } = await supabase
      .from('scripts')
      .insert({
        topic_id: topicId,
        title: scriptData.title,
        description: scriptData.description,
        tags: scriptData.tags,
        chapters: scriptData.chapters,
        script_text: scriptText,
      })
      .select('id')
      .single();

    if (scriptError) throw scriptError;

    // 5. Insert Scenes
    const sceneInserts = scriptData.scenes.map((scene: any, index: number) => ({
      script_id: insertedScript.id,
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

    // 6. Update Topic Status
    await supabase
      .from('topics')
      .update({ status: 'scenes_planned' })
      .eq('id', topicId);

  } catch (error) {
    console.error('Failed to generate script and scenes:', error);
    throw new Error('Generation failed');
  }

  revalidatePath(`/dashboard/topics/${topicId}`);
  redirect(`/dashboard/topics/${topicId}`);
}
