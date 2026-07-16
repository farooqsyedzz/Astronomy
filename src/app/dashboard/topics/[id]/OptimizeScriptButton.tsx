'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { optimizeScript } from '@/features/quality/actions';
import { Wand2 } from 'lucide-react';

export function OptimizeScriptButton({ topicId, scriptId }: { topicId: string, scriptId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleOptimize = () => {
    startTransition(async () => {
      try {
        const summary = await optimizeScript(topicId, scriptId);
        alert('Script optimized successfully!\n\nChanges:\n' + summary);
      } catch (error: any) {
        alert(error.message || 'Failed to optimize script');
      }
    });
  };

  return (
    <Button variant="secondary" onClick={handleOptimize} disabled={isPending}>
      <Wand2 style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
      {isPending ? 'Optimizing...' : 'Optimize Script'}
    </Button>
  );
}
