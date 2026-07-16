import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// We default to a strong free model on OpenRouter, like deepseek-chat or llama-3.
const DEFAULT_MODEL = 'openrouter/free';

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

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON. Raw text (first 500 chars):', cleaned.substring(0, 500));
    throw e;
  }
}

export async function runQACompletion(prompt: string, model: string = DEFAULT_MODEL, retries: number = 1): Promise<any> {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });
    
    const text = response?.choices?.[0]?.message?.content;
    if (text) {
      try {
        return robustParseJSON(text);
      } catch (parseError) {
        if (retries > 0) {
          console.warn(`JSON parse failed, retrying... (${retries} retries left)`);
          return runQACompletion(prompt, model, retries - 1);
        }
        throw parseError;
      }
    }
    
    console.error("OpenRouter Response missing text:", JSON.stringify(response, null, 2));
    throw new Error("No response text from OpenRouter");
  } catch (error) {
    if (retries > 0) {
      console.warn(`API call failed, retrying... (${retries} retries left)`);
      return runQACompletion(prompt, model, retries - 1);
    }
    console.error('Error in runQACompletion:', error);
    throw new Error('Failed to execute QA module via OpenRouter');
  }
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
  "competitorAnalysis": "What are existing videos doing? What is the gap?",
  "suggestedTitles": ["Title 1", "Title 2", "Title 3"],
  "potentialHooks": ["Hook 1", "Hook 2", "Hook 3"]
}

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });

    const text = response.choices[0]?.message?.content;
    if (text) {
      return robustParseJSON(text);
    }
    
    throw new Error("No response text from OpenRouter");
  } catch (error) {
    console.error('Error generating research:', error);
    throw new Error('Failed to generate research via OpenRouter');
  }
}

export async function generateScript(researchContent: any): Promise<any> {
  const prompt = `
You are an expert YouTube scriptwriter. Your job is to take the provided research and write a highly engaging, educational documentary-style script for a faceless YouTube channel.

Research Data:
${JSON.stringify(researchContent, null, 2)}

Requirements:
1. The script should be formatted for a 3-5 minute video.
2. Hook the viewer in the first 10 seconds.
3. Write naturally for a voiceover (use simple language, short sentences).
4. Do not include camera directions or scene descriptions in the script text, ONLY the words to be spoken.

Your output must be a valid JSON object with the following structure:
{
  "title": "Final selected title for the video",
  "description": "SEO optimized description for YouTube",
  "tags": ["tag1", "tag2", "tag3"],
  "scriptText": "The entire spoken script as a single long string, without scene markers.",
  "chapters": [
    { "timestamp": "0:00", "title": "Intro" },
    { "timestamp": "1:00", "title": "Main Point 1" }
  ]
}

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });

    const text = response.choices[0]?.message?.content;
    if (text) {
      return robustParseJSON(text);
    }
    
    throw new Error("No response text from OpenRouter");
  } catch (error) {
    console.error('Error generating script:', error);
    throw new Error('Failed to generate script via OpenRouter');
  }
}

export async function generateScenes(scriptText: string): Promise<any> {
  const prompt = `
You are an expert YouTube video director. I will give you the voiceover script for a faceless educational YouTube video.
Your job is to break the script down into individual scenes and plan the visuals (images) for each scene.

Script:
"${scriptText}"

Rules:
1. Break the script into logical visual scenes (each scene should be 5-15 seconds of narration).
2. For each scene, extract the exact narration text that belongs to that scene.
3. Write a highly detailed, descriptive image generation prompt for the visual of that scene. The prompt should be suitable for an AI image generator (like Midjourney or DALL-E) to create a cinematic, photorealistic 16:9 image.
4. Specify a subtle camera animation type for the image (e.g., 'pan_right', 'zoom_in', 'static', 'pan_left').
5. Estimate the duration of the scene based on the narration length (assume normal speaking pace).

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
      max_tokens: 8000,
    });

    let text = response.choices[0]?.message?.content;
    if (text) {
      return robustParseJSON(text);
    }
    
    throw new Error("No response text from OpenRouter");
  } catch (error) {
    console.error('Error generating scenes:', error);
    throw new Error('Failed to generate scenes via OpenRouter');
  }
}
