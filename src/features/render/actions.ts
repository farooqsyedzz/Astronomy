'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function triggerRenderPipeline(topicId: string, enableSubtitles: boolean = true) {
  const supabase = await createClient();

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // e.g. "username/repo"

  if (!githubToken || !githubRepo) {
    throw new Error('GitHub configuration is missing in environment variables');
  }

  // Update status to 'rendering'
  await supabase
    .from('topics')
    .update({ status: 'rendering' })
    .eq('id', topicId);

  // Trigger GitHub Action
  const response = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/render.yml/dispatches`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main', // The branch to run the workflow on
      inputs: {
        topicId: topicId,
        subtitles: enableSubtitles ? 'true' : 'false',
      }
    })
  });

  if (!response.ok) {
    // Revert status on failure
    await supabase
      .from('topics')
      .update({ status: 'assets_generated' })
      .eq('id', topicId);
      
    const errorText = await response.text();
    console.error('GitHub API Error:', errorText);
    throw new Error(`Failed to trigger rendering pipeline: ${response.statusText}`);
  }

  revalidatePath(`/dashboard/topics/${topicId}`);
}

export async function deleteVideo(topicId: string, videoId: string, videoUrl: string) {
  const supabase = await createClient();

  // 1. Delete from DB
  const { error: dbError } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId);
    
  if (dbError) throw new Error('Failed to delete video from database');

  // 2. Try deleting from storage if URL points to our storage
  try {
    const urlObj = new URL(videoUrl);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf('assets');
    if (bucketIndex !== -1 && pathParts.length > bucketIndex + 1) {
      const storagePath = pathParts.slice(bucketIndex + 1).join('/');
      await supabase.storage.from('assets').remove([storagePath]);
    }
  } catch (e) {
    console.error('Failed to parse or delete video storage URL:', e);
  }

  // 3. Revert topic status if no videos left
  const { data: videos } = await supabase.from('videos').select('id').eq('topic_id', topicId);
  if (!videos || videos.length === 0) {
    await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);
  }

  revalidatePath(`/dashboard/topics/${topicId}`);
}
