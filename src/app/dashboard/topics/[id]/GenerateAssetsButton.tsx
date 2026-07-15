'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Image as ImageIcon } from 'lucide-react';
import { generateAssets } from '@/features/assets/actions';

export function GenerateAssetsButton({ topicId, disabled }: { topicId: string, disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await generateAssets(topicId);
      } catch (error) {
        alert('Failed to generate assets. Please check your storage configuration.');
      }
    });
  };

  return (
    <Button 
      variant="primary" 
      disabled={disabled || isPending}
      onClick={handleGenerate}
    >
      <ImageIcon style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
      {isPending ? 'Generating Assets (1-2 mins)...' : 'Generate Assets'}
    </Button>
  );
}
