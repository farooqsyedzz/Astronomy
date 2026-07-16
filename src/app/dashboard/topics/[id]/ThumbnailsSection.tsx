'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { generateThumbnails, renderThumbnail, selectThumbnail } from '@/features/quality/actions';
import { Image as ImageIcon, Play, Check } from 'lucide-react';

export function ThumbnailsSection({ topicId, thumbnails = [] }: { topicId: string, thumbnails: any[] }) {
  const [isPending, startTransition] = useTransition();

  const handleGenerateConcepts = () => {
    startTransition(async () => {
      try {
        await generateThumbnails(topicId);
      } catch (error: any) {
        alert(error.message || 'Failed to generate thumbnails');
      }
    });
  };

  const handleRender = (thumbnailId: string) => {
    startTransition(async () => {
      try {
        await renderThumbnail(topicId, thumbnailId);
      } catch (error: any) {
        alert(error.message || 'Failed to render thumbnail');
      }
    });
  };

  const handleSelect = (thumbnailId: string) => {
    startTransition(async () => {
      try {
        await selectThumbnail(topicId, thumbnailId);
      } catch (error: any) {
        alert(error.message || 'Failed to select thumbnail');
      }
    });
  };

  return (
    <Card style={{ marginBottom: '2rem' }}>
      <CardHeader style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon />
          Thumbnails
        </CardTitle>
        <Button onClick={handleGenerateConcepts} disabled={isPending} variant="secondary">
          {isPending ? 'Working...' : 'Generate New Concepts'}
        </Button>
      </CardHeader>
      <CardContent>
        {thumbnails.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No thumbnails generated yet. Click "Generate New Concepts" to start.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {thumbnails.map((thumb) => (
              <div key={thumb.id} style={{ 
                backgroundColor: '#1f2937', 
                borderRadius: '0.5rem', 
                overflow: 'hidden',
                border: thumb.is_selected ? '2px solid #10b981' : '1px solid #374151'
              }}>
                {thumb.file_url ? (
                  <img src={thumb.file_url} alt={thumb.concept_title} style={{ width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', padding: '1rem', textAlign: 'center' }}>
                    <p>Image not rendered yet.<br/><small>Prompt: {thumb.image_prompt}</small></p>
                  </div>
                )}
                
                <div style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#e5e7eb' }}>{thumb.concept_title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>CTR: {thumb.estimated_ctr}%</span>
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Text: {thumb.overlay_text} ({thumb.text_position})</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!thumb.file_url && (
                      <Button variant="primary" onClick={() => handleRender(thumb.id)} disabled={isPending} style={{ flex: 1, padding: '0.5rem' }}>
                        <Play style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                        Render
                      </Button>
                    )}
                    {thumb.file_url && (
                      <Button variant="secondary" onClick={() => handleSelect(thumb.id)} disabled={thumb.is_selected || isPending} style={{ flex: 1, padding: '0.5rem' }}>
                        <Check style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                        {thumb.is_selected ? 'Selected' : 'Select'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
