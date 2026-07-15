'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function triggerRenderPipeline(topicId: string) {
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
