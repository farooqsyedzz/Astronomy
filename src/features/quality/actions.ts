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
  
  const prompt = `
I want to replace the opening intro of this script.
Please identify the first paragraph/scene of this script (the intro) and REMOVE IT.
Return ONLY the remainder of the script exactly as it is written, without changing a single word.

Script:
${script?.script_text}

Respond ONLY with a JSON object:
{ "restOfScript": "the remainder of the script" }
  `;
  
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '{}');
  
  if (parsed.restOfScript) {
    const newScriptText = newHook + '\n\n' + parsed.restOfScript;

    // 1. Update the script text
    await supabase.from('scripts').update({ script_text: newScriptText }).eq('id', scriptId);
    
    // 2. Safe regeneration: Attempt to generate new scenes
    const { generateScenes } = await import('@/services/ai');
    let scenesData = null;
    try {
      scenesData = await generateScenes(newScriptText, newHook);
    } catch (err) {
      console.error('Failed to generate scenes after applying hook:', err);
      throw new Error('Script was updated, but failed to automatically regenerate scenes. Please regenerate scenes manually.');
    }

    if (scenesData && scenesData.length > 0) {
      // Hook Preservation: Override scene 1 narration explicitly to guarantee no LLM drift
      scenesData[0].narration = newHook;

      // 3. Delete old scenes (this will cascade delete storyboards and assets)
      await supabase.from('scenes').delete().eq('script_id', scriptId);

      // 4. Insert new scenes
      const sceneInserts = scenesData.map((scene: any, index: number) => ({
        script_id: scriptId,
        narration: scene.narration,
        duration: scene.duration,
        image_prompt: scene.imagePrompt,
        animation_type: scene.animationType,
        order_index: index,
      }));

      await supabase.from('scenes').insert(sceneInserts);

      // 5. Invalidate status so user must generate assets again
      await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);
    }
  }
  
  revalidatePath(`/dashboard/topics/${topicId}`);
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

  const scriptText = topic.scripts[0].script_text;

  const prompt = `
You are an expert YouTube script editor focused on maximizing audience retention.
Review the following script and optimize it by:
1. Adding curiosity gaps between sections.
2. Improving transitions to maintain pacing.
3. Injecting surprising facts where appropriate to re-engage the viewer.
4. Ensuring the vocabulary is accessible but highly engaging.

Do NOT change the core scientific facts or the overall length drastically.

Original Script:
"${scriptText}"

Respond ONLY with a JSON object:
{
  "optimizedScriptText": "The full revised script.",
  "changesSummary": "A short summary of what you improved."
}
  `;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
  });

  const parsed = robustParseJSON(response.choices[0]?.message?.content || '{}');

  if (parsed.optimizedScriptText) {
    // 1. Update the script text
    await supabase.from('scripts').update({ script_text: parsed.optimizedScriptText }).eq('id', scriptId);

    // 2. Safe regeneration: Attempt to generate new scenes
    const { generateScenes } = await import('@/services/ai');
    let scenesData = null;
    try {
      scenesData = await generateScenes(parsed.optimizedScriptText);
    } catch (err) {
      console.error('Failed to generate scenes after optimizing script:', err);
      throw new Error('Script was updated, but failed to automatically regenerate scenes. Please regenerate scenes manually.');
    }

    if (scenesData && scenesData.length > 0) {
      // 3. Delete old scenes (this will cascade delete storyboards and assets)
      await supabase.from('scenes').delete().eq('script_id', scriptId);

      // 4. Insert new scenes
      const sceneInserts = scenesData.map((scene: any, index: number) => ({
        script_id: scriptId,
        narration: scene.narration,
        duration: scene.duration,
        image_prompt: scene.imagePrompt,
        animation_type: scene.animationType,
        order_index: index,
      }));

      await supabase.from('scenes').insert(sceneInserts);

      // 5. Invalidate status so user must generate assets again
      await supabase.from('topics').update({ status: 'scenes_planned' }).eq('id', topicId);
    }
  }

  revalidatePath(`/dashboard/topics/${topicId}`);
  return parsed.changesSummary;
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
