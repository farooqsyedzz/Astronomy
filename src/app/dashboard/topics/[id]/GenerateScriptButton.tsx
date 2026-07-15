'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Wand2 } from 'lucide-react';
import { generateScriptAndScenes } from '@/features/scripts/actions';

export function GenerateScriptButton({ topicId, disabled }: { topicId: string, disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await generateScriptAndScenes(topicId);
      } catch (error) {
        alert('Failed to generate script and scenes. Please try again.');
      }
    });
  };

  return (
    <Button 
      variant="primary" 
      disabled={disabled || isPending}
      onClick={handleGenerate}
    >
      <Wand2 style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
      {isPending ? 'Generating...' : 'Generate Script'}
    </Button>
  );
}
