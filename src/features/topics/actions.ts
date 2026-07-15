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
