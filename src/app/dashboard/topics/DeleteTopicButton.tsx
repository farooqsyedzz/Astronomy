'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import { deleteTopic } from '@/features/topics/actions';

export function DeleteTopicButton({ topicId, compact = false }: { topicId: string, compact?: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // In case it's inside a link
    if (confirm('Are you sure you want to delete this topic and ALL its generated files? This cannot be undone.')) {
      startTransition(async () => {
        try {
          await deleteTopic(topicId);
        } catch (error: any) {
          alert(error.message || 'Failed to delete topic.');
        }
      });
    }
  };

  return (
    <Button 
      variant="ghost" 
      disabled={isPending}
      onClick={handleDelete}
      style={{ color: '#ef4444', padding: compact ? '0.25rem' : '0.5rem', height: 'auto', zIndex: 10 }}
      title="Delete Topic"
    >
      <Trash2 style={{ width: compact ? '1rem' : '1.25rem', height: compact ? '1rem' : '1.25rem' }} />
      {!compact && isPending && <span style={{ marginLeft: '0.5rem' }}>Deleting...</span>}
    </Button>
  );
}
