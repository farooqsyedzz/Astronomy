'use server';

import { createClient } from '@/lib/supabase/server';
import { generateStoryboardBatch } from '@/services/motion/director';
import { revalidatePath } from 'next/cache';

/**
 * Generates storyboard instructions for all scenes of a topic.
 * Runs after asset generation, before rendering.
 */
export async function generateStoryboardAction(topicId: string) {
  const supabase = await createClient();

  // 1. Fetch all scenes
  const { data: topic } = await supabase
    .from('topics')
    .select('*, scripts(id, scenes(*))')
    .eq('id', topicId)
    .single();

  const script = topic?.scripts?.[0];
  if (!script || !script.scenes || script.scenes.length === 0) {
    throw new Error('No scenes found for storyboard generation');
  }

  const scenes = script.scenes.sort((a: any, b: any) => a.order_index - b.order_index);

  // 2. Generate storyboard instructions in batch
  console.log(`Generating storyboard for ${scenes.length} scenes...`);
  const storyboards = await generateStoryboardBatch(
    scenes.map((s: any) => ({ narration: s.narration, image_prompt: s.image_prompt }))
  );

  // 3. Update each scene with its storyboard instructions
  for (let i = 0; i < scenes.length; i++) {
    const { error } = await supabase
      .from('scenes')
      .update({ storyboard: storyboards[i] })
      .eq('id', scenes[i].id);

    if (error) {
      console.error(`Failed to save storyboard for scene ${scenes[i].id}:`, error);
    }
  }

  console.log('Storyboard generation complete.');
  revalidatePath(`/dashboard/topics/${topicId}`);
}
