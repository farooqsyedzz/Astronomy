import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateTopicResearch(topicName: string): Promise<any> {
  const prompt = `
You are an expert YouTube content strategist and researcher specializing in educational faceless channels.
I need you to thoroughly research the following topic: "${topicName}"

Your output must be a valid JSON object with the following structure:
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error('Error generating research:', error);
    throw new Error('Failed to generate research');
  }
}

export async function generateScript(researchContent: any): Promise<any> {
  const prompt = `
You are an expert YouTube scriptwriter. Your job is to take the provided research and write a highly engaging, educational documentary-style script for a faceless YouTube channel.

Research Data:
${JSON.stringify(researchContent, null, 2)}

Requirements:
- Tone: Engaging Educational Documentary.
- Word count: Aim for a 5-10 minute video (approx 800 - 1500 words).
- Write naturally for a voiceover artist. Do not include visual directions in the main text yet.

Your output must be a valid JSON object with the following structure:
{
  "title": "The finalized best title for the video",
  "description": "A 2 paragraph YouTube description optimized for SEO",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "chapters": [
    { "time": "00:00", "title": "Intro" },
    { "time": "01:30", "title": "Chapter 1" }
  ],
  "scriptText": "The full script text goes here. Use paragraphs."
}

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        temperature: 0.8,
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error('Error generating script:', error);
    throw new Error('Failed to generate script');
  }
}

export async function generateScenes(scriptText: string): Promise<any> {
  const prompt = `
You are an expert YouTube Video Editor and AI Image Prompter. Your job is to take a provided voiceover script and break it down into sequential visual scenes for a faceless video.

Script:
"${scriptText}"

Requirements for each scene:
- "narration": A 1-2 sentence chunk of the script text exactly as it appears in the script. Ensure no text is skipped.
- "duration": Estimated duration in seconds for reading this narration chunk (assume 150 words per minute, roughly 2.5 words per second).
- "imagePrompt": A highly detailed prompt for an AI image generator (like Midjourney or DALL-E) to create a visual that perfectly matches the narration. Be descriptive about style, lighting, and subject.
- "animationType": A suggested simple animation/Ken Burns effect (e.g., 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static').

Your output must be a valid JSON array of scene objects:
[
  {
    "narration": "The exact script snippet...",
    "duration": 5,
    "imagePrompt": "A highly detailed cinematic shot of...",
    "animationType": "zoom-in"
  }
]

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error('Error generating scenes:', error);
    throw new Error('Failed to generate scenes');
  }
}
