import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ArrowLeft, Edit3, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import styles from './topicDetail.module.css';
import { GenerateScriptButton } from './GenerateScriptButton';
import { GenerateAssetsButton } from './GenerateAssetsButton';
import { RenderVideoButton } from './RenderVideoButton';

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
    .select('*, research(content), scripts(*, scenes(*, assets(*))), videos(*)')
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
             <RenderVideoButton 
               topicId={topic.id} 
               disabled={false} 
               label={topic.status === 'rendering' ? 'Rendering... (Click to Retry)' : video ? 'Re-render Video' : 'Render Video'}
             />
          )}
          {video && (
             <Link href={`/dashboard/topics/${topic.id}/qa`} style={{ textDecoration: 'none' }}>
               <Button variant="default" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                 View QA Report
               </Button>
             </Link>
          )}
        </div>
      </header>

      {video && (
        <Card className={styles.finalVideoCard}>
          <CardHeader>
            <CardTitle>Final Rendered Video</CardTitle>
          </CardHeader>
          <CardContent>
            <video controls className={styles.finalVideoPlayer} src={video.final_video_url}>
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
              <p className={styles.paragraph}>{research.competitorAnalysis}</p>
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
          <div className={styles.scriptHeader}>
            <h3 className={styles.sectionTitle}>Video Script & Scenes</h3>
            <p className={styles.scriptMeta}>
              Title: {script.title} | {scenes.length} Scenes
            </p>
          </div>

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
