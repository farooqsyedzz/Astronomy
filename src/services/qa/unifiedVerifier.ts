import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export interface UnifiedQAResult {
  topic_result?: QAModuleResult;
  script_result?: QAModuleResult;
  scenes_result?: QAModuleResult;
  images_result?: QAModuleResult;
  thumbnail_result?: QAModuleResult;
  seo_result?: QAModuleResult;
}

export async function runUnifiedQA(
  topicTitle: string, 
  research: any, 
  script: any, 
  scenes: any[]
): Promise<UnifiedQAResult> {
  const prompt = `
You are an expert QA Orchestrator for an educational YouTube channel.
Your task is to verify the quality of all generated assets in a single pass.

Input Data:
=========================================
Topic Title: "${topicTitle}"

Research:
${JSON.stringify({
  summary: research?.summary,
  targetAudience: research?.targetAudience,
  uniqueAngle: research?.competitorAnalysis?.uniqueAngle
})}

Script:
Title: ${script?.title}
Text: ${script?.script_text}

Scenes:
${JSON.stringify(scenes.map(s => ({ order: s.order_index, nar: s.narration, img: s.image_prompt })))}
=========================================

You must evaluate 6 distinct modules and return a unified JSON response containing results for ALL 6 modules.

Evaluation Criteria per module:

1. topic_result:
   - Does the title hook the viewer?
   - Is the target audience clear?
   - Is the unique angle actually unique?

2. script_result:
   - Hook Quality (first 10 seconds)?
   - Story Flow & Pacing?
   - Grammar & Clarity?
   - Scientific Accuracy?
   * If there are factual or grammar errors, provide an "auto_fixes" array with { "scene_order": num, "issue_type": "...", "original_text": "...", "new_scene_narration": "Full rewritten scene", "reason": "..." }.

3. scenes_result:
   - Do the scenes match the script completely?
   - Are scenes in correct logical order?
   - Are transitions logical?

4. images_result:
   - Do the image_prompts match the narration of their respective scenes?
   - Are the prompts cinematic, highly detailed, and missing negative constraints?
   * If a prompt is bad, provide an "auto_fixes" array with { "scene_id": "...", "problem": "...", "fixed_prompt": "..." }.

5. thumbnail_result:
   - Does the suggested title pair well with the thumbnail idea from research?

6. seo_result:
   - Are the keywords and tags relevant?

Return a JSON object with this exact structure:
{
  "topic_result": { "score": 0-100, "confidence": 0-100, "passed": true/false, "issues": ["1-line max"], "recommendations": ["1-line max"] },
  "script_result": {
    "score": 0-100,
    "confidence": 0-100,
    "passed": true/false,
    "issues": ["1-line max"],
    "recommendations": ["1-line max"],
    "auto_fixes": [ { "scene_order": 0, "issue_type": "...", "original_text": "...", "new_scene_narration": "Full rewritten scene", "reason": "..." } ]
  },
  "scenes_result": { "score": 0-100, "confidence": 0-100, "passed": true/false, "issues": ["1-line max"], "recommendations": ["1-line max"] },
  "images_result": {
    "score": 0-100,
    "confidence": 0-100,
    "passed": true/false,
    "issues": ["1-line max"],
    "recommendations": ["1-line max"],
    "auto_fixes": [ { "scene_id": "...", "problem": "...", "fixed_prompt": "..." } ]
  },
  "thumbnail_result": { "score": 0-100, "confidence": 0-100, "passed": true/false, "issues": ["1-line max"], "recommendations": ["1-line max"] },
  "seo_result": { "score": 0-100, "confidence": 0-100, "passed": true/false, "issues": ["1-line max"], "recommendations": ["1-line max"] }
}

CRITICAL INSTRUCTIONS TO PREVENT TRUNCATION:
- Keep ALL text in "issues", "recommendations", and "reason" under 10 words. BE EXTREMELY CONCISE.
- If you find ANY issues in the script or images, you MUST provide "auto_fixes" to resolve them.
Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const rawResult = await runQACompletion(prompt);
    
    // Normalize the response to match the unified format
    const unifiedResult: UnifiedQAResult = {};

    if (rawResult.topic_result) {
      unifiedResult.topic_result = {
        module_name: 'topic',
        score: rawResult.topic_result.score || 0,
        confidence: rawResult.topic_result.confidence || 0,
        passed: rawResult.topic_result.passed || false,
        status: 'completed',
        issues: rawResult.topic_result.issues || [],
        recommendations: rawResult.topic_result.issues || []
      };
    }

    if (rawResult.script_result) {
      unifiedResult.script_result = {
        module_name: 'script',
        score: rawResult.script_result.score || 0,
        confidence: rawResult.script_result.confidence || 0,
        passed: rawResult.script_result.passed || false,
        status: 'completed',
        issues: rawResult.script_result.issues || [],
        recommendations: rawResult.script_result.recommendations || [],
        auto_fix: { fixes: rawResult.script_result.auto_fixes || [] }
      };
    }

    if (rawResult.scenes_result) {
      unifiedResult.scenes_result = {
        module_name: 'scenes',
        score: rawResult.scenes_result.score || 0,
        confidence: rawResult.scenes_result.confidence || 0,
        passed: rawResult.scenes_result.passed || false,
        status: 'completed',
        issues: rawResult.scenes_result.issues || [],
        recommendations: rawResult.scenes_result.recommendations || []
      };
    }

    if (rawResult.images_result) {
      const autoFixes = rawResult.images_result.auto_fixes || [];
      const firstFix = autoFixes.length > 0 ? autoFixes[0] : null;
      
      unifiedResult.images_result = {
        module_name: 'images',
        score: rawResult.images_result.score || 0,
        confidence: rawResult.images_result.confidence || 0,
        passed: rawResult.images_result.passed || false,
        status: 'completed',
        issues: rawResult.images_result.issues || [],
        recommendations: rawResult.images_result.recommendations || [],
        auto_fix: firstFix ? {
          scene_id: firstFix.scene_id,
          problem: firstFix.problem,
          fixed_prompt: firstFix.fixed_prompt,
          can_autofix: true
        } : undefined
      };
    }

    if (rawResult.thumbnail_result) {
      unifiedResult.thumbnail_result = {
        module_name: 'thumbnail',
        score: rawResult.thumbnail_result.score || 0,
        confidence: rawResult.thumbnail_result.confidence || 0,
        passed: rawResult.thumbnail_result.passed || false,
        status: 'completed',
        issues: rawResult.thumbnail_result.issues || [],
        recommendations: rawResult.thumbnail_result.recommendations || []
      };
    }

    if (rawResult.seo_result) {
      unifiedResult.seo_result = {
        module_name: 'seo',
        score: rawResult.seo_result.score || 0,
        confidence: rawResult.seo_result.confidence || 0,
        passed: rawResult.seo_result.passed || false,
        status: 'completed',
        issues: rawResult.seo_result.issues || [],
        recommendations: rawResult.seo_result.recommendations || []
      };
    }

    return unifiedResult;
  } catch (error: any) {
    console.error("Unified QA Error:", error);
    return {}; // Return empty object so fallbacks will trigger
  }
}
