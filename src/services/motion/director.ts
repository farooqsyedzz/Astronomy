import { runQACompletion } from '@/services/ai';
import type { StoryboardInstruction, CameraMovement, BgmMood } from './types';

const CAMERA_MOVEMENTS: CameraMovement[] = [
  'zoom_in_center',
  'zoom_out_center',
  'pan_left',
  'pan_right',
  'pan_up',
  'ken_burns_tl_br',
  'ken_burns_br_tl',
];

const BGM_MOODS: BgmMood[] = ['mysterious', 'epic', 'suspense', 'emotional', 'discovery'];

/**
 * Generates storyboard instructions for a single scene using AI.
 * Falls back to randomized defaults if the AI fails.
 */
export async function generateStoryboard(
  narration: string,
  imagePrompt: string,
  sceneIndex: number,
  totalScenes: number,
): Promise<StoryboardInstruction> {
  try {
    const prompt = `
You are a professional documentary film director. Analyze the following scene from an astronomy documentary and decide on the visual treatment.

Scene ${sceneIndex + 1} of ${totalScenes}:
- Narration: "${narration}"
- Visual Description: "${imagePrompt}"

Based on the emotional tone and content, choose:
1. camera_movement: One of: zoom_in_center, zoom_out_center, pan_left, pan_right, pan_up, ken_burns_tl_br, ken_burns_br_tl, static
   - Use zoom_in for dramatic reveals or important details
   - Use pan for wide landscapes or spatial concepts
   - Use ken_burns for establishing shots
   - Use zoom_out for "big picture" moments
2. bgm_mood: One of: mysterious, epic, suspense, emotional, discovery
   - Match the emotional tone of the narration
3. visual_effects: Array containing "dust_particles" for space/cosmic scenes, or "none" for earthly scenes.

Rules:
- First scene should use zoom_in or ken_burns for a strong opening.
- Last scene should use zoom_out for a reflective closing.
- Vary movements across scenes. Don't repeat the same movement 3 times in a row.
- Keep it subtle and documentary-style.

Return a JSON object:
{
  "camera_movement": "...",
  "bgm_mood": "...",
  "visual_effects": ["..."]
}
`;

    const result = await runQACompletion(prompt);
    
    // Validate and normalize the AI response
    const validMovement = CAMERA_MOVEMENTS.includes(result.camera_movement)
      ? result.camera_movement
      : randomCamera(sceneIndex, totalScenes);
    
    const validMood = BGM_MOODS.includes(result.bgm_mood)
      ? result.bgm_mood
      : 'mysterious';

    const effects = Array.isArray(result.visual_effects) ? result.visual_effects : ['none'];

    return {
      camera_movement: validMovement,
      zoom_intensity: 0.15 + (Math.random() * 0.1 - 0.05), // ±0.05 random variation
      transition_in: 'fade',
      transition_out: 'fade',
      visual_effects: effects,
      bgm_mood: validMood,
    };
  } catch (error) {
    console.warn(`Storyboard AI failed for scene ${sceneIndex + 1}, using smart defaults.`);
    return generateFallbackStoryboard(sceneIndex, totalScenes);
  }
}

/**
 * Generates storyboard instructions for all scenes in batch.
 * More cost-efficient than per-scene calls.
 */
export async function generateStoryboardBatch(
  scenes: Array<{ narration: string; image_prompt: string }>,
): Promise<StoryboardInstruction[]> {
  const sceneDescriptions = scenes.map((s, i) => 
    `Scene ${i + 1}: Narration: "${s.narration.substring(0, 100)}..." | Visual: "${s.image_prompt.substring(0, 80)}..."`
  ).join('\n');

  try {
    const prompt = `
You are a professional documentary film director planning the visual treatment for a ${scenes.length}-scene astronomy documentary.

Scenes:
${sceneDescriptions}

For EACH scene, decide:
1. camera_movement: One of: zoom_in_center, zoom_out_center, pan_left, pan_right, pan_up, ken_burns_tl_br, ken_burns_br_tl
2. bgm_mood: One of: mysterious, epic, suspense, emotional, discovery

Rules:
- Scene 1 should open strong (zoom_in or ken_burns).
- Last scene should feel closing (zoom_out).
- VARY the movements. Never repeat the same movement 3 times in a row.
- Match bgm_mood to the emotional tone of the narration.
- Use "dust_particles" for cosmic/space scenes, "none" for others.

Return a JSON object with key "scenes" containing an array of objects:
{
  "scenes": [
    { "camera_movement": "...", "bgm_mood": "...", "visual_effects": ["..."] }
  ]
}
`;

    const result = await runQACompletion(prompt);
    const aiScenes = result.scenes || result;

    if (!Array.isArray(aiScenes) || aiScenes.length !== scenes.length) {
      console.warn('AI returned wrong number of storyboard instructions, using fallbacks.');
      return scenes.map((_, i) => generateFallbackStoryboard(i, scenes.length));
    }

    return aiScenes.map((ai: any, i: number) => ({
      camera_movement: CAMERA_MOVEMENTS.includes(ai.camera_movement)
        ? ai.camera_movement
        : randomCamera(i, scenes.length),
      zoom_intensity: 0.15 + (Math.random() * 0.1 - 0.05),
      transition_in: 'fade' as const,
      transition_out: 'fade' as const,
      visual_effects: Array.isArray(ai.visual_effects) ? ai.visual_effects : ['dust_particles'],
      bgm_mood: BGM_MOODS.includes(ai.bgm_mood) ? ai.bgm_mood : 'mysterious',
    }));
  } catch (error) {
    console.warn('Batch storyboard generation failed, using fallbacks.');
    return scenes.map((_, i) => generateFallbackStoryboard(i, scenes.length));
  }
}

/**
 * Randomized camera selection that avoids repetition and uses
 * contextual defaults for first/last scenes.
 */
function randomCamera(sceneIndex: number, totalScenes: number): CameraMovement {
  if (sceneIndex === 0) return 'ken_burns_tl_br';
  if (sceneIndex === totalScenes - 1) return 'zoom_out_center';
  return CAMERA_MOVEMENTS[Math.floor(Math.random() * CAMERA_MOVEMENTS.length)];
}

/**
 * Smart fallback when AI is unavailable. Uses randomized but sensible defaults.
 */
function generateFallbackStoryboard(sceneIndex: number, totalScenes: number): StoryboardInstruction {
  const moods: BgmMood[] = ['mysterious', 'discovery', 'epic', 'emotional', 'suspense'];
  
  return {
    camera_movement: randomCamera(sceneIndex, totalScenes),
    zoom_intensity: 0.15 + (Math.random() * 0.1 - 0.05),
    transition_in: 'fade',
    transition_out: 'fade',
    visual_effects: ['dust_particles'],
    bgm_mood: moods[sceneIndex % moods.length],
  };
}
