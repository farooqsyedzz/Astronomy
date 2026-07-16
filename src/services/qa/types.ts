export type QAModuleStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type QADecision = 'APPROVED' | 'MINOR_IMPROVEMENTS' | 'REGENERATE';

export interface QAAutoFix {
  scene_id?: string;
  problem: string;
  fixed_prompt?: string;
  can_autofix: boolean;
}

export interface QAModuleResult {
  module_name: string;
  score: number;
  confidence: number;
  passed: boolean;
  status: QAModuleStatus;
  issues: string[];
  recommendations: string[];
  auto_fix?: QAAutoFix;
}

export interface QAReport {
  id?: string;
  video_id: string;
  overall_score: number;
  confidence: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  decision: QADecision;
  module_scores?: any; // To store aggregated scores if needed
  issues?: any;
  recommendations?: any;
  created_at?: string;
}

export interface QAModuleRun {
  id?: string;
  qa_report_id: string;
  module_name: string;
  status: QAModuleStatus;
  score: number;
  confidence: number;
  issues?: any;
  recommendations?: any;
  auto_fix?: any;
  created_at?: string;
  updated_at?: string;
}
