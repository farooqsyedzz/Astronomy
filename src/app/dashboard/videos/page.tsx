import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';

export default async function VideosPage() {
  const supabase = await createClient();

  const { data: videos, error } = await supabase
    .from('videos')
    .select('*, topics(id, title)');

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>Error loading videos: {error.message}</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Your Videos</h1>
      
      {(!videos || videos.length === 0) ? (
        <p style={{ color: 'var(--muted-foreground)' }}>No videos found. Go to a topic and render one!</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {videos.map((video) => (
            <Card key={video.id}>
              <CardHeader>
                <CardTitle>{video.topics?.title || 'Unknown Topic'}</CardTitle>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <video 
                  controls 
                  src={video.final_video_url} 
                  style={{ width: '100%', borderRadius: '0.5rem', backgroundColor: 'black' }}
                >
                  Your browser does not support the video tag.
                </video>
                <Link 
                  href={`/dashboard/topics/${video.topic_id}`}
                  style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}
                >
                  View Topic
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
