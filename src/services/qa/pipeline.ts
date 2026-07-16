import { createClient } from '@supabase/supabase-js';
import { runUnifiedQA } from './unifiedVerifier';
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
      if (!runId || !result) return;
      await supabase
        .from('qa_module_runs')
        .update({
          status: result.status || 'failed',
          score: result.score || 0,
          confidence: result.confidence || 0,
          issues: result.issues || [],
          recommendations: result.recommendations || [],
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

    // 4. Run Unified QA Mega-Prompt
    console.log(`Running unified QA mega-prompt for topic ${topicId}...`);
    const unifiedResults = await runUnifiedQA(topic.title, research, script, scenes);

    // 5. Apply Results and Handle Fallbacks
    const promises = [];

    // Topic
    if (unifiedResults.topic_result) {
      promises.push(finishModuleRun(topicRunId, unifiedResults.topic_result).then(() => unifiedResults.topic_result));
    } else {
      console.log('Fallback: Running topic verifier independently');
      promises.push(verifyTopic(topic.title, research, script).then(async res => { await finishModuleRun(topicRunId, res); return res; }));
    }

    // Script
    if (unifiedResults.script_result) {
      promises.push(finishModuleRun(scriptRunId, unifiedResults.script_result).then(() => unifiedResults.script_result));
    } else {
      console.log('Fallback: Running script verifier independently');
      promises.push(verifyScript(script).then(async res => { await finishModuleRun(scriptRunId, res); return res; }));
    }

    // Scenes
    if (unifiedResults.scenes_result) {
      promises.push(finishModuleRun(scenesRunId, unifiedResults.scenes_result).then(() => unifiedResults.scenes_result));
    } else {
      console.log('Fallback: Running scenes verifier independently');
      promises.push(verifyScenes(script?.script_text || '', scenes).then(async res => { await finishModuleRun(scenesRunId, res); return res; }));
    }

    // Images
    if (unifiedResults.images_result) {
      promises.push(finishModuleRun(imagesRunId, unifiedResults.images_result).then(() => unifiedResults.images_result));
    } else {
      console.log('Fallback: Running images verifier independently');
      promises.push(verifyImages(scenes).then(async res => { await finishModuleRun(imagesRunId, res); return res; }));
    }

    // Thumbnail
    if (unifiedResults.thumbnail_result) {
      promises.push(finishModuleRun(thumbnailRunId, unifiedResults.thumbnail_result).then(() => unifiedResults.thumbnail_result));
    } else {
      console.log('Fallback: Running thumbnail verifier independently');
      promises.push(verifyThumbnail().then(async res => { await finishModuleRun(thumbnailRunId, res); return res; }));
    }

    // SEO
    if (unifiedResults.seo_result) {
      promises.push(finishModuleRun(seoRunId, unifiedResults.seo_result).then(() => unifiedResults.seo_result));
    } else {
      console.log('Fallback: Running seo verifier independently');
      promises.push(verifySEO(script).then(async res => { await finishModuleRun(seoRunId, res); return res; }));
    }

    const [topicRes, scriptRes, scenesRes, imagesRes, thumbRes, seoRes] = await Promise.all(promises);

    // 5. Final Judge
    const results = [topicRes, scriptRes, scenesRes, imagesRes, thumbRes, seoRes] as QAModuleResult[];
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
