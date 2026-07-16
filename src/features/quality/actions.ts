'use server';

import { createClient } from '@/lib/supabase/server';
import { robustParseJSON, DEFAULT_MODEL, client } from '@/services/ai';
import { revalidatePath } from 'next/cache';

// 1. Generate Multiple Hooks
export async function generateMultipleHooks(topicId: string) {
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('*, research(*), scripts(*)')
    .eq('id', topicId)
    .single();

  if (!topic || !topic.scripts || topic.scripts.length === 0) {
    throw new Error('Script not found for this topic.');
  }

  const scriptText = topic.scripts[0].script_text;
  const research = topic.research[0]?.content;

  const prompt = `
You are an expert YouTube producer. 
Here is the research for a topic: ${JSON.stringify(research)}
Here is the current script:
"${scriptText}"

Please generate 3-5 different opening hooks (the first 10-15 seconds of the script) that are designed to maximize viewer retention. 
Provide a predicted retention score (0-100) for each hook based on curiosity, emotional pull, and relevance.

Respond ONLY with a valid JSON array of objects with the exact following structure:
[
  {
    "hookText": "The exact spoken text of the new hook.",
    "predictedRetention": 95,
    "rationale": "Why this hook works."
  }
]
`;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('No response from AI');
  
  return robustParseJSON(text);
}

// 2. Apply a selected hook
export async function applyHook(topicId: string, scriptId: string, newHook: string) {
  const supabase = await createClient();
  
  // We need to replace the beginning of the script. This is tricky to do programmatically if the script is long.
  // Instead, we will ask the AI to rewrite the script starting with the new hook.
  // Or simply prepend the hook and let the user edit. For simplicity and correctness, we just update the scriptText,
  // but wait, if the script is already converted to scenes, we need to regenerate scenes!
  
  // Actually, modifying a script means scenes are now out of date. 
  // Let's just update the script text. The user will have to regenerate scenes.
  
  // First get current script
  const { data: script } = await supabase.from('scripts').select('script_text').eq('id', scriptId).single();
  
  const scriptText = script?.script_text;
  
  const prompt = `
You are an expert video director. We are replacing the first scene of our video script with a new hook.
Below is the original script text, and the new hook we want to use.

Original Script:
"${scriptText}"

New Hook:
"${newHook}"

Task:
1. Identify the intro paragraph(s) of the Original Script that should be replaced by the New Hook.
2. Output the "restOfScript" (the original script minus the old intro).
3. Write a highly detailed, 16:9 cinematic image prompt for the New Hook.

Respond ONLY with a JSON object:
{
  "restOfScript": "The rest of the script untouched.",
  "newSceneImagePrompt": "Cinematic 16:9 photorealistic image of..."
}
  `;
  
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '{}');
  
  if (parsed.restOfScript && parsed.newSceneImagePrompt) {
    const newScriptText = newHook + '\n\n' + parsed.restOfScript;

    // 1. Update the script text
    await supabase.from('scripts').update({ script_text: newScriptText }).eq('id', scriptId);
    
    // 2. Fetch the FIRST scene to update it
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, narration')
      .eq('script_id', scriptId)
      .order('order_index', { ascending: true })
      .limit(1);

    let originalIntro = '';

    if (scenes && scenes.length > 0) {
      originalIntro = scenes[0].narration;

      // 3. Update ONLY the first scene with the new hook and new visual prompt
      await supabase.from('scenes').update({
        narration: newHook,
        image_prompt: parsed.newSceneImagePrompt
      }).eq('id', scenes[0].id);

      // 4. Delete storyboards and assets ONLY for the first scene
      // Wait, deleting the scene cascades. Since we just update it, we must manually delete its child assets if they exist, or let the user regenerate.
      // Easiest is to set status to scenes_planned so it triggers regeneration of storyboards.
      await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);
    }
    
    revalidatePath(`/dashboard/topics/${topicId}`);
    return { originalIntro, newHook };
  }
  
  revalidatePath(`/dashboard/topics/${topicId}`);
  return { originalIntro: '', newHook };
}

// 3. Optimize Script
export async function optimizeScript(topicId: string, scriptId: string) {
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('*, scripts(*)')
    .eq('id', topicId)
    .single();

  if (!topic || !topic.scripts || topic.scripts.length === 0) {
    throw new Error('Script not found.');
  }

  const targetSceneCount = topic.scene_count || 10;
  const sentencesPerScene = topic.sentences_per_scene || '2-3';
  const scriptText = topic.scripts[0].script_text;

  const prompt = `
You are an expert YouTube script editor focused on maximizing audience retention.
Your ONLY job is to refine and polish the following script.

CRITICAL RULES:
1. Do NOT reduce the total sentence count. You may improve the phrasing or slightly expand the length, but NEVER shorten the script.
2. Preserve the exact same story structure.
3. The script MUST be formatted into exactly ${targetSceneCount} logical scenes.
4. Each scene MUST contain exactly ${sentencesPerScene} sentences.
5. Focus ONLY on improving clarity, pacing, transitions, curiosity gaps, and storytelling engagement.
6. Write a highly detailed 16:9 cinematic image prompt for each scene.

Original Script:
"${scriptText}"

Respond ONLY with a JSON object:
{
  "changesSummary": "A short summary of what you improved.",
  "scenes": [
    {
      "narration": "The exact spoken text for this scene.",
      "imagePrompt": "Cinematic 16:9 photorealistic image of...",
      "animationType": "zoom_in",
      "duration": 8
    }
  ]
}
  `;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '{}');

  if (parsed.scenes && Array.isArray(parsed.scenes)) {
    // 1. Programmatically enforce the scene count on the merged output
    const { enforceSceneCount } = await import('@/services/ai');
    let scenesData = enforceSceneCount(parsed.scenes, targetSceneCount);

    // 2. Reconstruct script text
    const optimizedScriptText = scenesData.map((s: any) => s.narration).join('\n\n');

    // 3. Update the script text
    await supabase.from('scripts').update({ script_text: optimizedScriptText }).eq('id', scriptId);

    // 4. Delete old scenes (this will cascade delete storyboards and assets)
    await supabase.from('scenes').delete().eq('script_id', scriptId);

    // 5. Insert new scenes
    const sceneInserts = scenesData.map((scene: any, index: number) => ({
      script_id: scriptId,
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

    // 6. Reset topic status
    await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);

    return {
      summary: parsed.changesSummary,
      originalScript: scriptText,
      newScript: optimizedScriptText
    };
  }

  return { summary: "Failed to parse scenes from optimizer output", originalScript: scriptText, newScript: scriptText };
}

// 4. Run Producer Review
export async function runProducerReview(topicId: string) {
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('*, research(*), scripts(*, scenes(*))')
    .eq('id', topicId)
    .single();

  if (!topic || !topic.scripts || topic.scripts.length === 0) {
    throw new Error('Project context missing');
  }

  const prompt = `
You are a master YouTube documentary producer. Review this upcoming video project.
Research: ${JSON.stringify(topic.research[0]?.content)}
Script & Scenes: ${JSON.stringify(topic.scripts[0])}

Evaluate the project on a scale of 0-100 for the following categories:
1. hook_score: How strong is the opening?
2. storytelling_score: Does it have a narrative arc?
3. accuracy_score: Is the science sound?
4. retention_score: Are there curiosity gaps and pacing variations?
5. seo_score: Are the titles and metadata optimized?

Provide an overall_score (0-100) and actionable feedback.

Respond ONLY with a JSON object:
{
  "hook_score": 85,
  "storytelling_score": 90,
  "accuracy_score": 95,
  "retention_score": 80,
  "seo_score": 88,
  "overall_score": 88,
  "feedback": ["Great hook.", "Needs better pacing in scene 3."]
}
  `;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '{}');

  // Insert review
  await supabase.from('producer_reviews').insert({
    topic_id: topicId,
    hook_score: parsed.hook_score,
    storytelling_score: parsed.storytelling_score,
    accuracy_score: parsed.accuracy_score,
    retention_score: parsed.retention_score,
    seo_score: parsed.seo_score,
    overall_score: parsed.overall_score,
    feedback: parsed.feedback
  });

  // Update readiness score
  await supabase.from('topics').update({ readiness_score: parsed.overall_score }).eq('id', topicId);

  revalidatePath(`/dashboard/topics/${topicId}`);
  return parsed;
}

// 5. Generate Thumbnails
export async function generateThumbnails(topicId: string) {
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('*, research(*)')
    .eq('id', topicId)
    .single();

  if (!topic) throw new Error('Topic not found');

  const research = topic.research[0]?.content;
  
  const prompt = `
You are an expert YouTube thumbnail designer.
Topic: ${topic.title}
Research: ${JSON.stringify(research)}

Generate 3-5 different thumbnail concepts for this video.
Do NOT include any text inside the image prompt. The image prompt should just be a striking, cinematic background.
The text will be overlaid separately. Provide the exact text that should be overlaid (very short, 2-5 words).

Respond ONLY with a JSON array of objects:
[
  {
    "concept_title": "The name of this concept",
    "image_prompt": "Cinematic description of the background image without any text in it",
    "overlay_text": "THE SHORT TEXT",
    "text_position": "center", // 'center', 'bottom', 'top', 'bottom-right'
    "font_size": 120,
    "font_color": "#ffffff",
    "stroke_color": "#000000",
    "estimated_ctr": 85
  }
]
  `;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '[]');

  // Insert all concepts into DB. They will be rendered asynchronously or by a separate action.
  for (const concept of parsed) {
    await supabase.from('thumbnails').insert({
      topic_id: topicId,
      concept_title: concept.concept_title,
      image_prompt: concept.image_prompt,
      overlay_text: concept.overlay_text,
      text_position: concept.text_position,
      font_size: concept.font_size,
      font_color: concept.font_color,
      stroke_color: concept.stroke_color,
      estimated_ctr: concept.estimated_ctr
    });
  }

  revalidatePath(`/dashboard/topics/${topicId}`);
  return parsed;
}

// 6. Render Thumbnail Image + Text Overlay
export async function renderThumbnail(topicId: string, thumbnailId: string) {
  const supabase = await createClient();

  const { data: thumb } = await supabase
    .from('thumbnails')
    .select('*')
    .eq('id', thumbnailId)
    .single();

  if (!thumb) throw new Error('Thumbnail not found');

  // 1. Generate the background image
  const { generateImageBuffer } = await import('@/services/image'); // Dynamic import just in case
  const imageBuffer = await generateImageBuffer(thumb.image_prompt);

  if (!imageBuffer) throw new Error('Failed to generate background image');

  // 2. Add text overlay using sharp
  const sharp = (await import('sharp')).default;

  // We create an SVG with the text to overlay it
  // We assume a 1920x1080 canvas for the thumbnail
  const width = 1920;
  const height = 1080;
  
  let textY = '50%';
  let textAnchor = 'middle';
  let textX = '50%';
  
  if (thumb.text_position === 'bottom') textY = '90%';
  else if (thumb.text_position === 'top') textY = '15%';
  else if (thumb.text_position === 'bottom-right') {
    textY = '90%';
    textX = '95%';
    textAnchor = 'end';
  }

  const svgText = `
    <svg width="${width}" height="${height}">
      <style>
        .title { 
          fill: ${thumb.font_color || '#ffffff'}; 
          font-size: ${thumb.font_size || 150}px; 
          font-family: Arial, sans-serif;
          font-weight: bold;
          paint-order: stroke;
          stroke: ${thumb.stroke_color || '#000000'};
          stroke-width: 15px;
        }
      </style>
      <text x="${textX}" y="${textY}" text-anchor="${textAnchor}" class="title">${thumb.overlay_text}</text>
    </svg>
  `;

  const finalBuffer = await sharp(imageBuffer)
    .resize(width, height)
    .composite([
      {
        input: Buffer.from(svgText),
        top: 0,
        left: 0,
      },
    ])
    .webp({ quality: 90 }) // using webp for compression
    .toBuffer();

  // 3. Upload to Supabase Storage
  const fileName = `${topicId}/thumbnail_${thumbnailId}_${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(fileName, finalBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadError) throw new Error('Failed to upload thumbnail: ' + uploadError.message);

  const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(fileName);

  // 4. Update DB
  await supabase
    .from('thumbnails')
    .update({ file_url: publicUrlData.publicUrl })
    .eq('id', thumbnailId);

  revalidatePath(`/dashboard/topics/${topicId}`);
}

// 7. Select Thumbnail
export async function selectThumbnail(topicId: string, thumbnailId: string) {
  const supabase = await createClient();

  // Deselect all thumbnails for this topic
  await supabase
    .from('thumbnails')
    .update({ is_selected: false })
    .eq('topic_id', topicId);

  // Select the chosen one
  await supabase
    .from('thumbnails')
    .update({ is_selected: true })
    .eq('id', thumbnailId);

  revalidatePath(`/dashboard/topics/${topicId}`);
}
