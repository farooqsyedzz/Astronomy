import { runQACompletion } from '../ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DirectorResponse {
  assistantResponse: string;
  targetSceneId: string;
  updatedNarration: string | null;
  updatedImagePrompt: string | null;
  updatedStoryboard: any | null;
  assetsToRegenerate: Array<'image' | 'voice'>;
}

/**
 * Context Builder constructs an optimized JSON payload for the AI Director
 * to keep token usage low while maintaining narrative context.
 */
export function buildDirectorContext(
  topic: any,
  script: any,
  scenes: any[],
  qaReport: any,
  mode: 'full' | 'scene' | 'auto' = 'full',
  targetSceneId?: string
) {
  // Base context that is always included
  const baseContext = {
    topic: topic.title,
    researchSummary: topic.research?.[0]?.content?.summary,
    scriptTitle: script?.title,
  };

  // Strip large assets (like video URLs and image blobs) from scenes
  const optimizedScenes = scenes.map((s) => ({
    id: s.id,
    order_index: s.order_index,
    narration: s.narration,
    image_prompt: s.image_prompt,
    storyboard: s.storyboard,
    // Provide asset status only, omit URLs
    hasImage: s.assets?.some((a: any) => a.type === 'image'),
    hasVoice: s.assets?.some((a: any) => a.type === 'voice'),
  }));

  if (mode === 'scene' && targetSceneId) {
    const targetIdx = optimizedScenes.findIndex(s => s.id === targetSceneId);
    if (targetIdx !== -1) {
      const start = Math.max(0, targetIdx - 1);
      const end = Math.min(optimizedScenes.length, targetIdx + 2);
      return {
        ...baseContext,
        contextMode: 'scene',
        focusedSceneId: targetSceneId,
        scenes: optimizedScenes.slice(start, end),
        qaIssues: qaReport?.issues,
      };
    }
  }

  // Default 'full' mode (or if 'auto' resolved to full)
  return {
    ...baseContext,
    contextMode: 'full',
    focusedSceneId: targetSceneId || 'none',
    scenes: optimizedScenes,
    qaIssues: qaReport?.issues,
  };
}

export async function processDirectorInstruction(
  instruction: string,
  history: ChatMessage[],
  projectContext: any
): Promise<DirectorResponse> {
  const prompt = `
You are the AI Director of a documentary film studio. You are helping a user edit a generated documentary scene-by-scene via chat.

Current Project Context (Optimized):
${JSON.stringify(projectContext, null, 2)}

Chat History:
${JSON.stringify(history, null, 2)}

User Instruction: "${instruction}"

YOUR TASK:
Analyze the user's instruction. Determine which scene(s) they want to modify (default to 'focusedSceneId' in context if unspecified). 
Make the exact changes requested (e.g. rewriting narration, changing the image prompt, or updating storyboard instructions).

RULES:
1. ONLY return fields that are explicitly changed. If narration is unchanged, return null for it.
2. If narration changes, "voice" MUST be in assetsToRegenerate.
3. If image prompt changes, "image" MUST be in assetsToRegenerate.
4. If storyboard changes (camera/bgm), do NOT add to assetsToRegenerate (these apply at render time).
5. The 'assistantResponse' should be a friendly, concise message explaining what you changed.

Output MUST be valid JSON matching this schema:
{
  "assistantResponse": "string",
  "targetSceneId": "string (the UUID of the scene being modified)",
  "updatedNarration": "string | null",
  "updatedImagePrompt": "string | null",
  "updatedStoryboard": { "camera_movement": "...", "bgm_mood": "...", "visual_effects": ["..."] } | null,
  "assetsToRegenerate": ["image", "voice"] // Array of strings. Empty if no assets need regeneration.
}
`;

  try {
    const result = await runQACompletion(prompt);
    
    // Validate output
    if (!result.targetSceneId || typeof result.assistantResponse !== 'string') {
      throw new Error("AI Director returned invalid response structure");
    }

    return {
      assistantResponse: result.assistantResponse,
      targetSceneId: result.targetSceneId,
      updatedNarration: result.updatedNarration || null,
      updatedImagePrompt: result.updatedImagePrompt || null,
      updatedStoryboard: result.updatedStoryboard || null,
      assetsToRegenerate: Array.isArray(result.assetsToRegenerate) ? result.assetsToRegenerate : [],
    };
  } catch (error) {
    console.error("AI Director Service failed:", error);
    throw new Error("Failed to process AI Director instruction");
  }
}
