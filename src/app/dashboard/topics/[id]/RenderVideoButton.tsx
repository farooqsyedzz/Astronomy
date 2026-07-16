'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Play } from 'lucide-react';
import { triggerRenderPipeline } from '@/features/render/actions';

export function RenderVideoButton({ topicId, disabled, label }: { topicId: string, disabled: boolean, label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [enableSubtitles, setEnableSubtitles] = useState(true);

  const handleRender = () => {
    startTransition(async () => {
      try {
        await triggerRenderPipeline(topicId, enableSubtitles);
        alert('Render pipeline triggered successfully! The video is rendering in the background.');
      } catch (error: any) {
        alert(error.message || 'Failed to trigger render pipeline.');
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#ccc' }}>
        <input 
          type="checkbox" 
          checked={enableSubtitles} 
          onChange={(e) => setEnableSubtitles(e.target.checked)} 
          disabled={disabled || isPending}
        />
        CC
      </label>
      <Button 
        variant="primary" 
        disabled={disabled || isPending}
        onClick={handleRender}
      >
        <Play style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
        {isPending ? 'Starting Render...' : (label || 'Render Video')}
      </Button>
    </div>
  );
}
