'use server';

import { createClient } from '@/lib/supabase/server';
import { generateTopicResearch } from '@/services/ai';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createTopicAndResearch(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  if (!title) {
    throw new Error('Title is required');
  }

  const sceneCount = parseInt(formData.get('sceneCount') as string) || 10;
  const sentencesPerScene = formData.get('sentencesPerScene') as string || '2-3';

  // 1. Get or create a default channel for the user
  let { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!channel) {
    const { data: newChannel, error: channelError } = await supabase
      .from('channels')
      .insert({ user_id: user.id, name: 'My First Channel' })
      .select('id')
      .single();
      
    if (channelError) throw channelError;
    channel = newChannel;
  }

  // 2. Create the topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .insert({
      channel_id: channel.id,
      title,
      status: 'researching',
      scene_count: sceneCount,
      sentences_per_scene: sentencesPerScene,
    })
    .select('id')
    .single();

  if (topicError) throw topicError;

  // 3. Trigger Gemini Research
  try {
    const researchData = await generateTopicResearch(title);

    // 4. Save research to DB
    await supabase.from('research').insert({
      topic_id: topic.id,
      content: researchData,
    });

    // 5. Update topic status
    await supabase
      .from('topics')
      .update({ status: 'research_complete' })
      .eq('id', topic.id);
      
  } catch (error) {
    console.error('Research generation failed', error);
    await supabase
      .from('topics')
      .update({ status: 'research_failed' })
      .eq('id', topic.id);
  }

  revalidatePath('/dashboard/topics');
  redirect(`/dashboard/topics/${topic.id}`);
}

export async function deleteTopic(topicId: string) {
  const supabase = await createClient();

  // 1. List all files in the topic folder in storage
  const { data: files, error: listError } = await supabase.storage
    .from('assets')
    .list(topicId);

  // 2. Delete files from storage
  if (files && files.length > 0) {
    const filePaths = files.map(file => `${topicId}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from('assets')
      .remove(filePaths);
    if (removeError) {
      console.error('Failed to delete storage files:', removeError);
    }
  }

  // 3. Delete the topic from DB (this cascades to scripts, scenes, assets, videos, research)
  const { error: dbError } = await supabase
    .from('topics')
    .delete()
    .eq('id', topicId);

  if (dbError) {
    throw new Error('Failed to delete topic from database');
  }

  revalidatePath('/dashboard/topics');
  redirect('/dashboard/topics');
}
