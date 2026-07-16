'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import { deleteVideo } from '@/features/render/actions';

export function DeleteVideoButton({ topicId, videoId, videoUrl }: { topicId: string, videoId: string, videoUrl: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this video? This cannot be undone.')) {
      startTransition(async () => {
        try {
          await deleteVideo(topicId, videoId, videoUrl);
        } catch (error: any) {
          alert(error.message || 'Failed to delete video.');
        }
      });
    }
  };

  return (
    <Button 
      variant="ghost" 
      disabled={isPending}
      onClick={handleDelete}
      style={{ color: '#ef4444', padding: '0.5rem', height: 'auto' }}
      title="Delete Video"
    >
      <Trash2 style={{ width: '1.25rem', height: '1.25rem' }} />
      {isPending && <span style={{ marginLeft: '0.5rem' }}>Deleting...</span>}
    </Button>
  );
}
