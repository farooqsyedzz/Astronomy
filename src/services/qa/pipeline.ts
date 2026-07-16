import { createClient } from '@supabase/supabase-js';
import { verifyTopic } from './topicVerifier';
import { verifyScript } from './scriptVerifier';
import { verifyScenes } from './sceneVerifier';
import { verifyImages } from './imageVerifier';
import { verifyThumbnail } from './thumbnailVerifier';
import { verifySEO } from './seoVerifier';
import { judgeFinalScore } from './finalJudge';
import { QAModuleResult } from './types';

// We need an admin client to run background tasks safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function runQAPipeline(topicId: string, videoId: string) {
  try {
    // 1. Fetch all data needed for QA
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('*, research(*), scripts(*, scenes(*, assets(*)))')
      .eq('id', topicId)
      .single();

    if (topicError || !topic) throw new Error('Failed to fetch topic data for QA');

    const research = topic.research?.[0];
    const script = topic.scripts?.[0];
    const scenes = script?.scenes || [];

    // 2. Create the initial QA Report
    const { data: report, error: reportError } = await supabase
      .from('qa_reports')
      .insert({
        video_id: videoId,
        status: 'running',
      })
      .select()
      .single();

    if (reportError || !report) throw new Error('Failed to create QA report');
    const reportId = report.id;

    // Helper to update module status in DB
    async function initModuleRun(moduleName: string) {
      const { data } = await supabase
        .from('qa_module_runs')
        .insert({
          qa_report_id: reportId,
          module_name: moduleName,
          status: 'running'
        })
        .select()
        .single();
      return data?.id;
    }

    async function finishModuleRun(runId: string, result: QAModuleResult) {
      if (!runId) return;
      await supabase
        .from('qa_module_runs')
        .update({
          status: result.status,
          score: result.score,
          confidence: result.confidence,
          issues: result.issues,
          recommendations: result.recommendations,
          auto_fix: result.auto_fix,
          updated_at: new Date().toISOString()
        })
        .eq('id', runId);
    }

    // 3. Initialize all runs
    const topicRunId = await initModuleRun('topic');
    const scriptRunId = await initModuleRun('script');
    const scenesRunId = await initModuleRun('scenes');
    const imagesRunId = await initModuleRun('images');
    const thumbnailRunId = await initModuleRun('thumbnail');
    const seoRunId = await initModuleRun('seo');

    // 4. Execute all QA modules concurrently
    const [topicRes, scriptRes, scenesRes, imagesRes, thumbRes, seoRes] = await Promise.all([
      verifyTopic(topic.title, research, script).then(async (res) => {
        await finishModuleRun(topicRunId, res);
        return res;
      }),
      verifyScript(script).then(async (res) => {
        await finishModuleRun(scriptRunId, res);
        return res;
      }),
      verifyScenes(script?.script_text || '', scenes).then(async (res) => {
        await finishModuleRun(scenesRunId, res);
        return res;
      }),
      verifyImages(scenes).then(async (res) => {
        await finishModuleRun(imagesRunId, res);
        return res;
      }),
      verifyThumbnail().then(async (res) => {
        await finishModuleRun(thumbnailRunId, res);
        return res;
      }),
      verifySEO(script).then(async (res) => {
        await finishModuleRun(seoRunId, res);
        return res;
      })
    ]);

    // 5. Final Judge
    const results = [topicRes, scriptRes, scenesRes, imagesRes, thumbRes, seoRes];
    const { overall_score, decision, confidence } = judgeFinalScore(results);

    // 6. Update QA Report
    await supabase
      .from('qa_reports')
      .update({
        overall_score,
        confidence,
        decision,
        status: 'completed'
      })
      .eq('id', reportId);

  } catch (error) {
    console.error('QA Pipeline failed:', error);
  }
}
