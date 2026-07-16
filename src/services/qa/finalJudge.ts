import { QAModuleResult, QADecision } from './types';

// Weights for each module
const WEIGHTS: Record<string, number> = {
  topic: 0.30,
  script: 0.25,
  images: 0.20,
  scenes: 0.10,
  seo: 0.10,
  thumbnail: 0.05
};

export function judgeFinalScore(moduleResults: QAModuleResult[]): { overall_score: number, decision: QADecision, confidence: number } {
  let totalScore = 0;
  let totalConfidence = 0;
  let weightSum = 0;

  let allPassed = true;

  for (const res of moduleResults) {
    if (res.status === 'skipped') continue;

    const weight = WEIGHTS[res.module_name] || 0;
    
    totalScore += (res.score * weight);
    totalConfidence += (res.confidence * weight);
    weightSum += weight;

    if (!res.passed) {
      allPassed = false;
    }
  }

  // Normalize if some modules were skipped
  const overall_score = weightSum > 0 ? Math.round(totalScore / weightSum) : 0;
  const confidence = weightSum > 0 ? Math.round(totalConfidence / weightSum) : 0;

  let decision: QADecision = 'REGENERATE';

  if (overall_score >= 90 && allPassed) {
    decision = 'APPROVED';
  } else if (overall_score >= 80) {
    decision = 'MINOR_IMPROVEMENTS';
  } else {
    decision = 'REGENERATE';
  }

  return { overall_score, decision, confidence };
}
