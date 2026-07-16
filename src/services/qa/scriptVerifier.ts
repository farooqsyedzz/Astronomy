import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export async function verifyScript(script: any): Promise<QAModuleResult> {
  const prompt = `
You are an expert QA Agent for an educational YouTube channel.
Your task is to verify the quality of the given Script.

Script:
Title: ${script?.title}
Text: ${script?.script_text}

Verify:
1. Hook Quality: Does it hook the viewer in the first 10 seconds?
2. Story Flow: Is the progression logical?
3. Grammar and Clarity: Are there any awkward sentences?
4. Repetition: Is any information redundantly repeated?
5. Ending & CTA: Is there a clear Call to Action at the end?
6. Scientific Accuracy: Verify any factual claims.

For any minor factual errors, grammar issues, or flow issues, provide an "auto_fixes" array.
Instead of replacing just one sentence, provide the ENTIRE rewritten scene narration for the affected scene.

Return a JSON object with this exact structure:
{
  "score": (0-100),
  "confidence": (0-100),
  "passed": (true if score >= 70, false otherwise),
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Rec 1", "Rec 2"],
  "auto_fixes": [
    {
      "scene_order": (The order_index of the scene containing the issue),
      "issue_type": "Scientific Fact" | "Grammar" | "Flow",
      "original_text": "The specific sentence that had the issue",
      "new_scene_narration": "The ENTIRE completely rewritten narration for this scene, incorporating the fix. This must be the full text for the scene, not just the fixed sentence.",
      "reason": "Explanation of the fix"
    }
  ]
}
Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const result = await runQACompletion(prompt);
    
    return {
      module_name: 'script',
      score: result.score || 0,
      confidence: result.confidence || 0,
      passed: result.passed || false,
      status: 'completed',
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      auto_fix: { fixes: result.auto_fixes || [] }
    };
  } catch (error: any) {
    return {
      module_name: 'script',
      score: 0,
      confidence: 0,
      passed: false,
      status: 'failed',
      issues: [error.message],
      recommendations: []
    };
  }
}
