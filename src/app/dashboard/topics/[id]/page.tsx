import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'auto';
export const revalidate = 30; // Cache for 30 seconds to reduce serverless invocations

import { ArrowLeft, Edit3, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import styles from './topicDetail.module.css';
import { GenerateScriptButton } from './GenerateScriptButton';
import { GenerateAssetsButton } from './GenerateAssetsButton';
import { RenderVideoButton } from './RenderVideoButton';
import { GenerateStoryboardButton } from './GenerateStoryboardButton';
import { DirectorChat } from './DirectorChat';
import { DeleteVideoButton } from './DeleteVideoButton';
import { DeleteTopicButton } from '../DeleteTopicButton';
import { ProducerReviewSection } from './ProducerReviewSection';
import { ThumbnailsSection } from './ThumbnailsSection';
import { OptimizeScriptButton } from './OptimizeScriptButton';
import { GenerateHooksButton } from './GenerateHooksButton';

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const supabase = await createClient();

  // Fetch Topic along with nested relations all the way to Assets
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*, research(content), scripts(*, scenes(*, assets(*))), videos(*), producer_reviews(*), thumbnails(*)')
    .eq('id', id)
    .single();

  if (topicError || !topic) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h1>Error loading topic</h1>
        <pre>{JSON.stringify(topicError, null, 2)}</pre>
        <p>Topic ID: {id}</p>
        <p>Topic Object: {JSON.stringify(topic, null, 2)}</p>
      </div>
    );
  }

  const research = topic.research && topic.research.length > 0 ? topic.research[0].content : null;
  const script = topic.scripts && topic.scripts.length > 0 ? topic.scripts[0] : null;
  const scenes = script?.scenes?.sort((a: any, b: any) => a.order_index - b.order_index) || [];

  const hasScript = !!script;
  const hasScenes = scenes.length > 0;
  const hasAssets = topic.status === 'assets_generated' || topic.status === 'rendering' || topic.status === 'render_complete';
  const video = topic.videos && topic.videos.length > 0 ? topic.videos[0] : null;
  
  console.log("DEBUG: topic.videos is", topic.videos);
  console.log("DEBUG: assigned video is", video);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard/topics" className={styles.backLink}>
            <ArrowLeft className={styles.backIcon} />
            Back to Topics
          </Link>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{topic.title}</h2>
            <span className={styles.statusBadge} data-status={topic.status}>
              {topic.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <DeleteTopicButton topicId={topic.id} />
          <Button variant="secondary">
            <Edit3 className={styles.iconSm} />
            Edit Topic
          </Button>
          {!hasScript && (
             <GenerateScriptButton topicId={topic.id} disabled={topic.status !== 'research_complete'} />
          )}
          {hasScript && !hasAssets && (
             <GenerateAssetsButton topicId={topic.id} disabled={topic.status !== 'scenes_planned'} />
          )}
          {hasAssets && (
            <>
             <GenerateStoryboardButton topicId={topic.id} disabled={false} />
             <RenderVideoButton 
               topicId={topic.id} 
               disabled={false} 
               label={topic.status === 'rendering' ? 'Rendering... (Click to Retry)' : video ? 'Re-render Video' : 'Render Video'}
             />
            </>
          )}
          {video && (
             <Link href={`/dashboard/topics/${topic.id}/qa`} style={{ textDecoration: 'none' }}>
               <Button variant="primary" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                 View QA Report
               </Button>
             </Link>
          )}
        </div>
      </header>

      {hasScript && (
        <>
          <ProducerReviewSection 
            topicId={topic.id} 
            initialScore={topic.readiness_score || null} 
            reviews={topic.producer_reviews?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []} 
          />
          <ThumbnailsSection 
            topicId={topic.id}
            thumbnails={topic.thumbnails?.sort((a: any, b: any) => b.estimated_ctr - a.estimated_ctr) || []}
          />
        </>
      )}

      {video && (
        <Card className={styles.finalVideoCard}>
          <CardHeader style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle>Final Rendered Video</CardTitle>
            <DeleteVideoButton topicId={topic.id} videoId={video.id} videoUrl={video.final_video_url} />
          </CardHeader>
          <CardContent>
            <video 
              controls 
              className={styles.finalVideoPlayer} 
              src={video.final_video_url}
              poster={topic.thumbnails?.find((t: any) => t.is_selected)?.file_url}
            >
              Your browser does not support the video tag.
            </video>
          </CardContent>
        </Card>
      )}

      {!hasScript && research && (
        <div className={styles.grid}>
          <Card className={styles.mainContent}>
            <CardHeader>
              <CardTitle>Research Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.paragraph}>{research.summary}</p>
              
              <h4 className={styles.subheading}>Key Points</h4>
              <ul className={styles.list}>
                {research.keyPoints?.map((point: string, i: number) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
              
              <h4 className={styles.subheading}>Competitor Analysis</h4>
              {typeof research.competitorAnalysis === 'string' ? (
                <p className={styles.paragraph}>{research.competitorAnalysis}</p>
              ) : research.competitorAnalysis ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: '#ccc' }}>
                  <div><strong>Common Titles:</strong> {research.competitorAnalysis.commonTitles?.join(', ')}</div>
                  <div><strong>Thumbnail Styles:</strong> {research.competitorAnalysis.thumbnailStyles}</div>
                  <div><strong>Missing Info:</strong> {research.competitorAnalysis.missingInformation}</div>
                  <div><strong>Unique Angle:</strong> {research.competitorAnalysis.uniqueAngle}</div>
                  <div><strong>Differentiation:</strong> {research.competitorAnalysis.differentiation}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
          
          <div className={styles.sidebar}>
             <Card>
              <CardHeader>
                <CardTitle>Target Audience</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={styles.paragraphSm}>{research.targetAudience}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Suggested Titles</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className={styles.listSm}>
                  {research.suggestedTitles?.map((title: string, i: number) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {hasScript && (
        <div className={styles.scriptContainer}>
          <div className={styles.scriptHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className={styles.sectionTitle}>Video Script & Scenes</h3>
              <p className={styles.scriptMeta}>
                Title: {script.title} | {scenes.length} Scenes
              </p>
            </div>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <OptimizeScriptButton topicId={topic.id} scriptId={script.id} />
                <GenerateHooksButton topicId={topic.id} scriptId={script.id} />
              </div>
            </div>
          </div>

          <Card className={styles.sceneCard} style={{ marginBottom: '2rem' }}>
            <CardHeader>
              <CardTitle>Raw Script</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: '1.5rem', whiteSpace: 'pre-wrap', color: '#d1d5db', lineHeight: 1.6 }}>
              {script.script_text}
            </CardContent>
          </Card>

          <div className={styles.scenesList}>
            {scenes.map((scene: any) => {
              const imageAsset = scene.assets?.find((a: any) => a.type === 'image');
              const voiceAsset = scene.assets?.find((a: any) => a.type === 'voice');

              return (
                <Card key={scene.id} className={styles.sceneCard}>
                  <CardContent className={styles.sceneContent}>
                    <div className={styles.sceneVisual}>
                      {imageAsset ? (
                        <div className={styles.imageContainer}>
                          <img src={imageAsset.file_url} alt="Scene visual" className={styles.sceneImage} />
                        </div>
                      ) : (
                        <div className={styles.visualPlaceholder}>
                          <ImageIcon className={styles.imageIcon} />
                          <span className={styles.visualText}>Asset Pending</span>
                        </div>
                      )}
                      
                      <div className={styles.visualDetails}>
                        <p className={styles.promptLabel}>Prompt:</p>
                        <p className={styles.promptText}>{scene.image_prompt}</p>
                        <div className={styles.badgesRow}>
                          <span className={styles.badge}>{scene.animation_type}</span>
                          <span className={styles.badge}>{scene.duration}s</span>
                          {scene.storyboard && (
                            <>
                              <span className={styles.badge} style={{ backgroundColor: '#a855f7', color: 'white' }}>🎬 {scene.storyboard.camera_movement}</span>
                              <span className={styles.badge} style={{ backgroundColor: '#6366f1', color: 'white' }}>🎵 {scene.storyboard.bgm_mood}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.sceneNarration}>
                      <div className={styles.narrationHeader}>
                        <span className={styles.sceneNumber}>Scene {scene.order_index + 1}</span>
                      </div>
                      <p className={styles.narrationText}>"{scene.narration}"</p>
                      
                      {voiceAsset && (
                        <div className={styles.audioPlayerContainer}>
                          <audio controls className={styles.audioPlayer}>
                            <source src={voiceAsset.file_url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                      
                      <div style={{ marginTop: '16px' }}>
                        <DirectorChat topicId={topic.id} sceneId={scene.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
