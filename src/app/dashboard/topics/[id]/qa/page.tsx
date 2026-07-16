import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import AutoRefresh from '@/components/AutoRefresh';

export const dynamic = 'auto';
export const revalidate = 15; // Cache for 15 seconds to reduce serverless invocations

export default async function QADashboardPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  // Await searchParams in Next 15+
  const resolvedSearchParams = await searchParams;
  const showSuccessBanner = resolvedSearchParams?.success === 'autofix';
  
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('*, videos(*)')
    .eq('id', id)
    .single();

  if (!topic) {
    notFound();
  }

  const video = topic.videos?.[0];
  if (!video) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>No video found for this topic yet.</h2>
        <Link href={`/dashboard/topics/${topic.id}`}>Back to Topic</Link>
      </div>
    );
  }

  // Fetch QA reports history
  const { data: qaReports } = await supabase
    .from('qa_reports')
    .select('*, qa_module_runs(*)')
    .eq('video_id', video.id)
    .order('created_at', { ascending: false });

  const latestReport = qaReports?.[0];
  const isRunning = latestReport?.status === 'running' || latestReport?.status === 'pending';

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {isRunning && <AutoRefresh intervalMs={3000} />}
      
      {showSuccessBanner && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '0.5rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={20} />
          <strong>Fixes applied successfully!</strong> The script has been updated.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href={`/dashboard/topics/${topic.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)' }}>
          <ArrowLeft size={16} /> Back to Topic
        </Link>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>QA Report</h1>
      </div>

      {!latestReport ? (
        <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'var(--card)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <h3>No QA Report Generated Yet</h3>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '1rem' }}>Run the QA pipeline to verify video quality.</p>
          <form action="/api/qa/trigger" method="POST">
            <input type="hidden" name="topicId" value={topic.id} />
            <input type="hidden" name="videoId" value={video.id} />
            <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>
              Run QA Pipeline
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Overall Status */}
            <div style={{ padding: '2rem', backgroundColor: 'var(--card)', borderRadius: '0.5rem', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--foreground)' }}>Overall Quality Score: {latestReport.overall_score}%</h2>
                <p style={{ color: 'var(--muted-foreground)', margin: '0.5rem 0 0 0' }}>Confidence: {latestReport.confidence}%</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-block', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '999px', 
                  fontWeight: 'bold',
                  backgroundColor: latestReport.decision === 'APPROVED' ? 'rgba(34, 197, 94, 0.1)' : latestReport.decision === 'MINOR_IMPROVEMENTS' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: latestReport.decision === 'APPROVED' ? '#22c55e' : latestReport.decision === 'MINOR_IMPROVEMENTS' ? '#eab308' : '#ef4444'
                }}>
                  {latestReport.decision}
                </div>
                <p style={{ color: 'var(--muted-foreground)', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Status: {latestReport.status}</p>
              </div>
            </div>

            {/* Module Breakdown */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '1rem 0 0 0' }}>Module Breakdown</h3>
            {latestReport.qa_module_runs?.map((run: any) => (
              <div key={run.id} style={{ padding: '1.5rem', backgroundColor: 'var(--card)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {run.status === 'completed' && run.score >= 70 ? <CheckCircle color="#22c55e" size={20} /> : run.status === 'completed' ? <XCircle color="#ef4444" size={20} /> : <AlertCircle color="#eab308" size={20} />}
                    <h4 style={{ margin: 0, fontSize: '1.125rem', textTransform: 'capitalize' }}>{run.module_name}</h4>
                  </div>
                  <div style={{ fontWeight: 'bold', color: run.score >= 70 ? '#22c55e' : '#ef4444' }}>
                    {run.status === 'skipped' ? 'SKIPPED' : `${run.score}%`}
                  </div>
                </div>

                {run.issues && run.issues.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '0.25rem', borderLeft: '4px solid #ef4444' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#ef4444' }}>Issues Detected:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--foreground)' }}>
                      {run.issues.map((issue: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Original Image autofix logic */}
                {run.auto_fix && run.auto_fix.fixed_prompt && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: '0.25rem', borderLeft: '4px solid #3b82f6' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#3b82f6' }}>Auto-Fix Available (Image):</p>
                    <p style={{ margin: 0, color: 'var(--foreground)' }}><strong>Problem:</strong> {run.auto_fix.problem}</p>
                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--foreground)' }}><strong>Proposed Fix:</strong> {run.auto_fix.fixed_prompt}</p>
                    <form action={async () => { 'use server'; const { applyImageFixAction } = await import('@/features/qa/actions'); await applyImageFixAction(run.id, run.auto_fix.scene_order ?? run.auto_fix.scene_id); }} style={{ marginTop: '1rem' }}>
                      <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Apply Image Fix
                      </button>
                    </form>
                  </div>
                )}

                {/* New Script autofix logic */}
                {run.auto_fix && run.auto_fix.fixes && run.auto_fix.fixes.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.25rem', borderLeft: '4px solid #10b981' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#10b981' }}>Script Auto-Fixes Available ({run.auto_fix.fixes.length}):</p>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--foreground)' }}>
                      {run.auto_fix.fixes.map((fix: any, idx: number) => (
                        <li key={idx} style={{ marginBottom: '1rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#ef4444' }}>Original:</span> {fix.original_text}<br />
                          <span style={{ fontWeight: 'bold', color: '#10b981' }}>Suggestion:</span> {fix.new_scene_narration}<br />
                          <span style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Reason: {fix.reason}</span>
                        </li>
                      ))}
                    </ul>
                    <form action={async () => { 'use server'; const { applyScriptFixesAction } = await import('@/features/qa/actions'); await applyScriptFixesAction(run.id); }} style={{ marginTop: '1rem' }}>
                      <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Apply All Script Fixes
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sidebar / History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--card)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Actions</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <form action="/api/qa/trigger" method="POST">
                  <input type="hidden" name="topicId" value={topic.id} />
                  <input type="hidden" name="videoId" value={video.id} />
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                    Run QA Again
                  </button>
                </form>

                {/* Regeneration Actions */}
                {latestReport.qa_module_runs?.some((run: any) => (run.module_name === 'topic' || run.module_name === 'script') && run.score < 70) && (
                  <form action={async () => { 'use server'; const { regenerateScriptAction } = await import('@/features/qa/actions'); await regenerateScriptAction(topic.id); }}>
                    <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#ef4444', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                      Regenerate Script
                    </button>
                  </form>
                )}

                {latestReport.qa_module_runs?.some((run: any) => run.module_name === 'scenes' && run.score < 70) && (
                  <form action={async () => { 'use server'; const { regenerateScenesAction } = await import('@/features/qa/actions'); await regenerateScenesAction(topic.id); }}>
                    <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f97316', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                      Regenerate Scenes
                    </button>
                  </form>
                )}

                <form action={async () => { 'use server'; const { regenerateMissingAssetsAction } = await import('@/features/qa/actions'); await regenerateMissingAssetsAction(topic.id); }}>
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                    Regenerate Missing Assets
                  </button>
                </form>

                <form action={async () => { 'use server'; const { reRenderVideoAction } = await import('@/features/qa/actions'); await reRenderVideoAction(topic.id); }}>
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#8b5cf6', color: 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                    Re-Render Video
                  </button>
                </form>
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: 'var(--card)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {qaReports?.map((r: any, index: number) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: index === 0 ? 'rgba(59, 130, 246, 0.1)' : 'var(--background)', borderRadius: '0.25rem', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--foreground)' }}>{new Date(r.created_at).toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{r.decision}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: r.overall_score >= 90 ? '#22c55e' : r.overall_score >= 80 ? '#eab308' : '#ef4444' }}>
                      {r.overall_score}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
