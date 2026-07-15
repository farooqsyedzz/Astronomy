'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Play } from 'lucide-react';
import { triggerRenderPipeline } from '@/features/render/actions';

export function RenderVideoButton({ topicId, disabled }: { topicId: string, disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleRender = () => {
    startTransition(async () => {
      try {
        await triggerRenderPipeline(topicId);
        alert('Render pipeline triggered successfully! The video is rendering in the background.');
      } catch (error: any) {
        alert(error.message || 'Failed to trigger render pipeline.');
      }
    });
  };

  return (
    <Button 
      variant="primary" 
      disabled={disabled || isPending}
      onClick={handleRender}
    >
      <Play style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
      {isPending ? 'Starting Render...' : 'Render Video'}
    </Button>
  );
}
