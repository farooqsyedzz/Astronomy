'use server';

import { createClient } from '@/lib/supabase/server';
import { generateVoiceAudio } from '@/services/voice';
import { generateImageBuffer } from '@/services/image';
import { revalidatePath } from 'next/cache';

export async function generateAssets(topicId: string) {
  const supabase = await createClient();

  // 1. Fetch Scenes
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*, scripts(id, scenes(*))')
    .eq('id', topicId)
    .single();

  if (topicError || !topic || !topic.scripts || topic.scripts.length === 0) {
    throw new Error('Could not find scenes for this topic');
  }

  const validScript = topic.scripts.find((s: any) => s.scenes && s.scenes.length > 0);
  
  if (!validScript) {
    throw new Error('No scenes available to generate assets');
  }

  const scenes = validScript.scenes;

  // 1.5 Fetch Existing Assets for all scenes
  const sceneIds = scenes.map((s: any) => s.id);
  const { data: existingAssets } = await supabase
    .from('assets')
    .select('*')
    .in('scene_id', sceneIds)
    .eq('status', 'completed');

  // We process scenes sequentially to avoid rate limits (or memory spikes)
  for (const scene of scenes) {
    try {
      const sceneAssets = existingAssets?.filter((a: any) => a.scene_id === scene.id) || [];
      const hasVoice = sceneAssets.some((a: any) => a.type === 'voice');
      const hasImage = sceneAssets.some((a: any) => a.type === 'image');

      // 2. Generate and Upload Audio
      if (!hasVoice) {
        console.log(`Generating audio for scene ${scene.id}...`);
        const audioBuffer = await generateVoiceAudio(scene.narration);
        const audioPath = `${topicId}/scene_${scene.id}_voice.mp3`;
        
        const { error: audioUploadError } = await supabase.storage
          .from('assets')
          .upload(audioPath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });
          
        if (audioUploadError) throw audioUploadError;

        const { data: audioUrlData } = supabase.storage.from('assets').getPublicUrl(audioPath);
        
        // Insert Audio Asset Record with cache-busting query parameter
        await supabase.from('assets').insert({
          scene_id: scene.id,
          type: 'voice',
          file_url: `${audioUrlData.publicUrl}?v=${Date.now()}`,
          status: 'completed',
        });
      } else {
        console.log(`Skipping audio for scene ${scene.id}, already exists.`);
      }

      // 3. Generate and Upload Image
      if (!hasImage) {
        console.log(`Generating image for scene ${scene.id}...`);
        const imageBuffer = await generateImageBuffer(scene.image_prompt);
        const imagePath = `${topicId}/scene_${scene.id}_image.jpg`;
        
        const { error: imageUploadError } = await supabase.storage
          .from('assets')
          .upload(imagePath, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (imageUploadError) throw imageUploadError;

        const { data: imageUrlData } = supabase.storage.from('assets').getPublicUrl(imagePath);

        // Insert Image Asset Record with cache-busting query parameter
        await supabase.from('assets').insert({
          scene_id: scene.id,
          type: 'image',
          file_url: `${imageUrlData.publicUrl}?v=${Date.now()}`,
          status: 'completed',
        });
      } else {
        console.log(`Skipping image for scene ${scene.id}, already exists.`);
      }

    } catch (error) {
      console.error(`Error generating assets for scene ${scene.id}:`, error);
      // Depending on strictness, we could throw here or just let it continue for other scenes.
      // For this demo, we'll continue and update the topic status at the end anyway.
    }
  }

  // 4. Update Topic Status
  await supabase
    .from('topics')
    .update({ status: 'assets_generated' })
    .eq('id', topicId);

  revalidatePath(`/dashboard/topics/${topicId}`);
}
