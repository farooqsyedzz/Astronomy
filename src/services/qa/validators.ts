import { client, DEFAULT_MODEL, robustParseJSON } from '@/services/ai';

// Extract significant keywords from a text string (very simple heuristic)
function extractKeywords(text: string): string[] {
  const commonWords = new Set(['the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us']);
  
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3 && !commonWords.has(w));
  
  const counts: Record<string, number> = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(e => e[0]);
}

export function fastTopicValidation(topicTitle: string, scriptText: string): { passes: boolean; reason?: string } {
  const scriptLower = scriptText.toLowerCase();
  
  // 1. Check if the literal topic title or significant parts of it are in the script at all
  const titleWords = topicTitle.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
  let matchCount = 0;
  for (const w of titleWords) {
    if (scriptLower.includes(w)) matchCount++;
  }
  
  if (titleWords.length > 0 && matchCount === 0) {
    return { passes: false, reason: 'Failed fast validation: Core topic keywords are completely missing from the script.' };
  }
  
  return { passes: true };
}

export async function aiTopicValidation(topicTitle: string, scriptText: string) {
  const prompt = `
You are a stringent QA validator. Your ONLY job is to verify if the following script perfectly aligns with the required topic.

Required Topic: "${topicTitle}"

Script to validate:
"${scriptText}"

Rules:
1. The script MUST be exclusively about the Required Topic.
2. If it drifted into an unrelated topic (e.g. Maya civilization instead of Betelgeuse), score it a 0.
3. If it contains mostly relevant information with some minor tangents, score it 80-90.
4. If it is perfectly on-topic, score it 100.

Provide your output as a JSON object:
{
  "score": 100,
  "explanation": "Why you gave this score.",
  "offTopicSections": ["Quote of off-topic section 1", "Quote of off-topic section 2"]
}
  `;

  try {
    const { runQACompletion } = await import('@/services/ai');
    const result = await runQACompletion(prompt);
    return result;
  } catch (error) {
    console.error('Error during AI topic validation:', error);
    return { score: 0, explanation: 'API Error during validation', offTopicSections: [] };
  }
}

export async function validateTopic(topicTitle: string, scriptText: string) {
  // Stage 1: Fast deterministic check
  const fastCheck = fastTopicValidation(topicTitle, scriptText);
  if (!fastCheck.passes) {
    return { score: 0, explanation: fastCheck.reason, offTopicSections: [] };
  }

  // Stage 2: AI Validation
  return await aiTopicValidation(topicTitle, scriptText);
}
