import OpenAI from 'openai';
import { robustParseJSON } from '../ai';
import { QAModuleResult } from './types';

export async function verifyImages(scenes: any[]): Promise<QAModuleResult> {
  const visionModel = process.env.OPENROUTER_VISION_MODEL;

  if (!visionModel) {
    return {
      module_name: 'images',
      score: 100,
      confidence: 100,
      passed: true,
      status: 'skipped',
      issues: ["No vision model configured in OPENROUTER_VISION_MODEL"],
      recommendations: []
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  let totalScore = 0;
  let totalConfidence = 0;
  let issues: string[] = [];
  let recommendations: string[] = [];
  let failedSceneCount = 0;
  let firstAutoFix: any = null;

  for (const scene of scenes) {
    const imageAsset = scene.assets?.find((a: any) => a.type === 'image');
    if (!imageAsset || !imageAsset.file_url) continue;

    const promptText = `
You are an expert QA Agent verifying AI-generated images for a YouTube video.
Scene Narration: "${scene.narration}"

Verify:
1. Does the image visually match the narration?
2. Is the image scientifically or factually correct based on the context?
3. Is anything important missing?

Return a JSON object with this exact structure:
{
  "score": (0-100),
  "confidence": (0-100),
  "passed": (true if score >= 70, false otherwise),
  "issue": "Describe the issue if any, else empty string",
  "fixed_prompt": "If passed is false, provide a BETTER highly detailed image generation prompt to fix the issue."
}
Respond ONLY with valid JSON. Do not include markdown formatting.
`;

    try {
      const response = await client.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: imageAsset.file_url } }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0]?.message?.content;
      if (text) {
        const result = robustParseJSON(text);
        totalScore += result.score || 0;
        totalConfidence += result.confidence || 0;

        if (!result.passed) {
          failedSceneCount++;
          issues.push(`Scene ${scene.order_index}: ${result.issue}`);
          
          if (result.fixed_prompt && !firstAutoFix) {
            firstAutoFix = {
              scene_id: scene.id,
              problem: result.issue,
              fixed_prompt: result.fixed_prompt,
              can_autofix: true
            };
          }
        }
      }
    } catch (error) {
      console.error(`Error verifying image for scene ${scene.id}:`, error);
      issues.push(`Scene ${scene.order_index}: Failed to verify image via Vision API`);
      failedSceneCount++;
    }
  }

  const validScenesCount = scenes.filter(s => s.assets?.some((a: any) => a.type === 'image')).length;
  if (validScenesCount === 0) {
    return {
      module_name: 'images',
      score: 0,
      confidence: 100,
      passed: false,
      status: 'failed',
      issues: ["No images found to verify"],
      recommendations: []
    };
  }

  const avgScore = Math.round(totalScore / validScenesCount);
  const avgConfidence = Math.round(totalConfidence / validScenesCount);
  const passed = failedSceneCount === 0;

  return {
    module_name: 'images',
    score: avgScore,
    confidence: avgConfidence,
    passed,
    status: 'completed',
    issues,
    recommendations: passed ? [] : ["Regenerate the failed images using the provided fixed prompts"],
    auto_fix: firstAutoFix || undefined
  };
}
