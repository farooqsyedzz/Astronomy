import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export async function verifyScript(script: any): Promise<QAModuleResult> {
  const prompt = `
You are an expert QA Agent for an educational YouTube channel.
Your task is to verify the quality of the given Script.

Script:
${JSON.stringify(script)}

Verify:
1. Hook Quality: Does it hook the viewer in the first 10 seconds?
2. Story Flow: Is the progression logical?
3. Grammar and Clarity: Are there any awkward sentences?
4. Repetition: Is any information redundantly repeated?
5. Ending & CTA: Is there a clear Call to Action at the end?

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
      module_name: 'script',
      score: result.score || 0,
      confidence: result.confidence || 0,
      passed: result.passed || false,
      status: 'completed',
      issues: result.issues || [],
      recommendations: result.recommendations || []
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
