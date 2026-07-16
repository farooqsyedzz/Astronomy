import { runQACompletion } from '../ai';
import { QAModuleResult } from './types';

export async function verifyTopic(topicName: string, research: any, script: any): Promise<QAModuleResult> {
  const prompt = `
You are an expert QA Agent for an educational YouTube channel.
Your task is to verify the coherence between the original Topic, the Research, and the final Script.

Topic: "${topicName}"
Research Summary: "${research?.summary}"
Script Text: "${script?.script_text}"

Verify:
1. Is the script truly about the selected topic?
2. Are important concepts from the research covered in the script?
3. Is there irrelevant information?
4. Is the script scientifically accurate based on the research?

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
      module_name: 'topic',
      score: result.score || 0,
      confidence: result.confidence || 0,
      passed: result.passed || false,
      status: 'completed',
      issues: result.issues || [],
      recommendations: result.recommendations || []
    };
  } catch (error: any) {
    return {
      module_name: 'topic',
      score: 0,
      confidence: 0,
      passed: false,
      status: 'failed',
      issues: [error.message],
      recommendations: []
    };
  }
}
