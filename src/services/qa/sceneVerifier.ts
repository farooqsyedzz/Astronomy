import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export async function verifyScenes(scriptText: string, scenes: any[]): Promise<QAModuleResult> {
  const prompt = `
You are an expert QA Agent for an educational YouTube channel.
Your task is to verify that the generated Scenes perfectly match the original Script.

Original Script:
"${scriptText}"

Generated Scenes:
${JSON.stringify(scenes.map(s => ({ id: s.id, narration: s.narration, order_index: s.order_index })))}

Verify:
1. Does the combined scene narration match the script completely without missing large chunks?
2. Are the scenes in the correct logical order?
3. Are there any obviously duplicated scenes?
4. Are the scene transitions logical?

Return a JSON object with this exact structure:
{
  "score": (0-100),
  "confidence": (0-100),
  "passed": (true if score >= 70, false otherwise),
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Rec 1", "Rec 2"]
}
Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const result = await runQACompletion(prompt);
    
    return {
      module_name: 'scenes',
      score: result.score || 0,
      confidence: result.confidence || 0,
      passed: result.passed || false,
      status: 'completed',
      issues: result.issues || [],
      recommendations: result.recommendations || []
    };
  } catch (error: any) {
    return {
      module_name: 'scenes',
      score: 0,
      confidence: 0,
      passed: false,
      status: 'failed',
      issues: [error.message],
      recommendations: []
    };
  }
}
