'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';

export function GenerateStoryboardButton({ topicId, disabled }: { topicId: string; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    startTransition(async () => {
      const { generateStoryboardAction } = await import('@/features/storyboard/actions');
      await generateStoryboardAction(topicId);
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isPending}
      variant="primary"
      style={{ backgroundColor: '#a855f7', color: 'white' }}
    >
      {isPending ? 'Directing Storyboard...' : '🎬 Generate Storyboard'}
    </Button>
  );
}
