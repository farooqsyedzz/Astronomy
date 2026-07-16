'use server';

import { createClient } from '@/lib/supabase/server';
import { processDirectorInstruction, buildDirectorContext, type ChatMessage } from '@/services/director';
import { revalidatePath } from 'next/cache';

/**
 * Executes a director instruction from the user.
 * Interacts with the AI service, updates the DB, and deletes stale assets.
 */
export async function runDirectorAction(
  topicId: string, 
  instruction: string, 
  history: ChatMessage[],
  targetSceneId: string
) {
  const supabase = await createClient();

  // 1. Fetch full project context
  const { data: topic } = await supabase
    .from('topics')
    .select('*, research(*), scripts(*, scenes(*, assets(*)))')
    .eq('id', topicId)
    .single();

  if (!topic || !topic.scripts || topic.scripts.length === 0) {
    throw new Error('Project context not found');
  }

  const script = topic.scripts[0];
  const scenes = script.scenes.sort((a: any, b: any) => a.order_index - b.order_index);

  // 2. Build optimized context
  // Auto mode: If instruction contains "all", "entire", "throughout", use 'full' mode, else 'scene' mode.
  const isGlobalCmd = /all|entire|throughout|every/i.test(instruction);
  const contextMode = isGlobalCmd ? 'full' : 'scene';
  const optimizedContext = buildDirectorContext(topic, script, scenes, null, contextMode, targetSceneId);

  // 3. Call AI Director Service
  const response = await processDirectorInstruction(instruction, history, optimizedContext);

  // Fallback to UI-provided scene ID if AI fails to extract one (or makes one up)
  const finalSceneId = scenes.some((s: any) => s.id === response.targetSceneId) 
    ? response.targetSceneId 
    : targetSceneId;

  // 4. Update the Scene in Database
  const updates: any = {};
  if (response.updatedNarration) updates.narration = response.updatedNarration;
  if (response.updatedImagePrompt) updates.image_prompt = response.updatedImagePrompt;
  if (response.updatedStoryboard) updates.storyboard = response.updatedStoryboard;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('scenes')
      .update(updates)
      .eq('id', finalSceneId);
      
    if (updateError) {
      console.error('Failed to update scene:', updateError);
      throw new Error('Database update failed');
    }
  }

  // 5. Delete Stale Assets if required
  if (response.assetsToRegenerate.length > 0) {
    const typesToDelete = response.assetsToRegenerate;
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('scene_id', finalSceneId)
      .in('type', typesToDelete);

    if (deleteError) {
      console.error('Failed to delete stale assets:', deleteError);
    } else {
      // Revert topic status so the dashboard shows "Generate Missing Assets"
      await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);
    }
  }

  revalidatePath(`/dashboard/topics/${topicId}`);

  return {
    assistantResponse: response.assistantResponse,
    assetsDeleted: response.assetsToRegenerate
  };
}
