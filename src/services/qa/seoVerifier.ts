import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export async function verifySEO(script: any): Promise<QAModuleResult> {
  const prompt = `
You are an expert YouTube SEO specialist.
Your task is to verify the SEO quality of the proposed video metadata.

Video Title: "${script.title}"
Video Description: "${script.description}"
Video Tags: ${JSON.stringify(script.tags)}

Verify:
1. Title Relevance: Is the title catchy, relevant, and likely to get high CTR? Is it under 70 characters for best display?
2. Description Quality: Does the description contain strong keywords in the first 2 lines?
3. Tags/Keywords: Are the tags highly relevant and well-chosen?
4. Hashtags: Are there 3 relevant hashtags in the description?

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
      module_name: 'seo',
      score: result.score || 0,
      confidence: result.confidence || 0,
      passed: result.passed || false,
      status: 'completed',
      issues: result.issues || [],
      recommendations: result.recommendations || []
    };
  } catch (error: any) {
    return {
      module_name: 'seo',
      score: 0,
      confidence: 0,
      passed: false,
      status: 'failed',
      issues: [error.message],
      recommendations: []
    };
  }
}
