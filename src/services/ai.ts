import OpenAI from 'openai';

export const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// We default to a strong, fast free model on OpenRouter.
// openrouter/free often routes to slower reasoning models that time out.

/**
 * Robustly parse JSON from LLM output, handling common issues:
 * - Markdown code fences (```json ... ```)
 * - Trailing commas before } or ]
 * - Control characters
 */
export function robustParseJSON(text: string): any {
  // Strip markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '');
  }
  cleaned = cleaned.trim();

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Remove control characters (except newlines and tabs)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Escape literal newlines and tabs inside strings
  // This finds string literals and replaces actual \n and \t with escaped versions
  cleaned = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, function(match) {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON. Raw text (first 500 chars):', cleaned.substring(0, 500));
    throw e;
  }
}

export const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'poolside/laguna-m.1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'
];

export const DEFAULT_MODEL = FREE_MODELS[0];

export async function runQACompletion(prompt: string, modelList: string[] = FREE_MODELS, retries: number = 2): Promise<any> {
  let lastError = null;

  for (const currentModel of modelList) {
    try {
      console.log(`Trying OpenRouter model: ${currentModel}`);
      const response = await client.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
      });
      
      const text = response?.choices?.[0]?.message?.content;
      if (text) {
        try {
          return robustParseJSON(text);
        } catch (parseError) {
          if (retries > 0) {
            console.warn(`JSON parse failed on ${currentModel}, retrying...`);
            return runQACompletion(prompt, modelList, retries - 1);
          }
          throw parseError;
        }
      }
      
      console.error("OpenRouter Response missing text for model", currentModel);
      throw new Error("No response text from OpenRouter");
    } catch (error: any) {
      console.warn(`Model ${currentModel} failed: ${error?.message || 'Unknown error'}`);
      lastError = error;
      // If it's a parse error, it's not a model availability issue, but we still try the next model.
    }
  }

  throw lastError || new Error('All fallback models failed to execute QA module');
}

export async function generateTopicResearch(topicName: string): Promise<any> {
  const prompt = `
You are an expert YouTube content strategist and researcher specializing in educational faceless channels.
I need you to thoroughly research the following topic: "${topicName}"

Your output must be a valid JSON object with the exact following structure:
{
  "topic": "The given topic name",
  "summary": "A 2-3 paragraph summary of the topic.",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "targetAudience": "Description of the target audience",
  "searchIntent": "Why are people searching for this?",
  "competitorAnalysis": {
    "commonTitles": ["Example Title 1", "Example Title 2"],
    "thumbnailStyles": "What thumbnail styles are common?",
    "missingInformation": "What information do competitors miss?",
    "uniqueAngle": "What unique angle can our video take?",
    "differentiation": "How can we differentiate our video without copying?"
  },
  "suggestedTitles": ["Title 1", "Title 2", "Title 3"],
  "potentialHooks": ["Hook 1", "Hook 2", "Hook 3"]
}

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    return await runQACompletion(prompt);
  } catch (error) {
    console.error('Error generating research:', error);
    throw new Error('Failed to generate research via OpenRouter');
  }
}

export async function generateScript(researchContent: string, sceneCount: number = 10, sentencesPerScene: string = '2-3', topicTitle: string = ''): Promise<any> {
  const prompt = `
You are an expert documentary scriptwriter and video director for YouTube.
Using the following research, write a highly engaging, educational, and cinematic video script.

CRITICAL RULES:
1. The script MUST be exclusively about the topic: "${topicTitle}". Do not deviate to unrelated historical or scientific subjects.
2. The script MUST be formatted and paced to perfectly fit exactly ${sceneCount} visual scenes. Do not deviate from this length.
3. Each scene MUST contain exactly ${sentencesPerScene} sentences of spoken narration.
4. For each scene, write a highly detailed, descriptive image generation prompt (16:9 cinematic).
5. The FINAL scene (Scene ${sceneCount}) MUST contain a strong Call to Action (CTA) asking the viewer to subscribe or like.

Research:
${researchContent}

Respond ONLY with a valid JSON object matching this structure:
{
  "title": "A highly clickable YouTube title",
  "description": "A 2-sentence video description",
  "tags": ["tag1", "tag2", "tag3"],
  "chapters": [
    { "time": "00:00", "title": "Intro" }
  ],
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

  try {
    let parsed = await runQACompletion(prompt);
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      parsed.scenes = enforceSceneCount(parsed.scenes, sceneCount);
    }
    return parsed;
  } catch (error) {
    console.error('Error generating script:', error);
    throw new Error('Failed to generate script via OpenRouter');
  }
}

export function enforceSceneCount(parsedScenes: any[], targetSceneCount: number): any[] {
  let scenes = [...parsedScenes];
  
  // Programmatic Enforcement of Scene Count
  while (scenes.length > targetSceneCount) {
    // Too many scenes: merge the shortest adjacent scenes
    let minCombinedLen = Infinity;
    let mergeIdx = 0;
    for (let i = 0; i < scenes.length - 1; i++) {
      const len = scenes[i].narration.length + scenes[i+1].narration.length;
      if (len < minCombinedLen) {
        minCombinedLen = len;
        mergeIdx = i;
      }
    }
    // Merge mergeIdx and mergeIdx + 1
    scenes[mergeIdx].narration += " " + scenes[mergeIdx + 1].narration;
    scenes[mergeIdx].duration += scenes[mergeIdx + 1].duration;
    // Keep image prompt of the first one
    scenes.splice(mergeIdx + 1, 1);
  }

  while (scenes.length < targetSceneCount && scenes.length > 0) {
    // Too few scenes: split the longest scene
    let maxLen = 0;
    let splitIdx = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].narration.length > maxLen) {
        maxLen = scenes[i].narration.length;
        splitIdx = i;
      }
    }
    
    const sceneToSplit = scenes[splitIdx];
    const sentences = sceneToSplit.narration.split(/(?<=[.?!])\s+/);
    
    if (sentences.length > 1) {
      const half = Math.ceil(sentences.length / 2);
      const firstHalf = sentences.slice(0, half).join(' ');
      const secondHalf = sentences.slice(half).join(' ');
      
      const newScene = {
        narration: secondHalf,
        imagePrompt: sceneToSplit.imagePrompt + " (continued)",
        animationType: sceneToSplit.animationType,
        duration: Math.max(2, Math.floor(sceneToSplit.duration / 2))
      };
      
      sceneToSplit.narration = firstHalf;
      sceneToSplit.duration = Math.max(2, Math.ceil(sceneToSplit.duration / 2));
      
      scenes.splice(splitIdx + 1, 0, newScene);
    } else {
      // Cannot split by sentence, just break the loop to avoid infinite loop
      break;
    }
  }

  return scenes;
}

export async function generateScenes(scriptText: string, hookText?: string, targetSceneCount: number = 10, sentencesPerScene: string = '2-3'): Promise<any> {
  const prompt = `
You are an expert YouTube video director. I will give you the voiceover script for a faceless educational YouTube video.
Your job is to break the script down into individual scenes and plan the visuals (images) for each scene.

Script:
"${scriptText}"

Rules:
1. Break the script into EXACTLY ${targetSceneCount} visual scenes. This is a strict requirement.
2. Group the text so that each scene contains exactly ${sentencesPerScene} sentences.
3. For each scene, extract the exact narration text that belongs to that scene. Do not leave any script text behind.
4. Write a highly detailed, descriptive image generation prompt for the visual of that scene. The prompt should be suitable for an AI image generator (like Midjourney or DALL-E) to create a cinematic, photorealistic 16:9 image.
5. Specify a subtle camera animation type for the image (e.g., 'pan_right', 'zoom_in', 'static', 'pan_left').
6. Estimate the duration of the scene based on the narration length (assume normal speaking pace).
${hookText ? `7. CRITICAL: The very first scene MUST contain the exact following narration text, word for word, no exceptions: "${hookText}"` : ''}

Your output must be a valid JSON array of objects with the exact following structure:
[
  {
    "narration": "The exact spoken text for this scene.",
    "imagePrompt": "Cinematic 16:9 photorealistic image of...",
    "animationType": "zoom_in",
    "duration": 8
  }
]

Respond ONLY with valid JSON (an array). Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });

    let parsed = robustParseJSON(response.choices[0]?.message?.content || '[]');
  
    if (!Array.isArray(parsed) && parsed.scenes && Array.isArray(parsed.scenes)) {
      parsed = parsed.scenes;
    } else if (!Array.isArray(parsed) && Object.values(parsed).length === 1 && Array.isArray(Object.values(parsed)[0])) {
      parsed = Object.values(parsed)[0];
    }
    
    if (!Array.isArray(parsed)) {
      throw new Error('LLM failed to return a valid JSON array of scenes.');
    }

    return enforceSceneCount(parsed, targetSceneCount);
  } catch (error) {
    console.error('Error generating scenes:', error);
    throw new Error('Failed to generate scenes via OpenRouter');
  }
}
