'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { optimizeScript } from '@/features/quality/actions';
import { Wand2, X } from 'lucide-react';

export function OptimizeScriptButton({ topicId, scriptId }: { topicId: string, scriptId: string }) {
  const [isPending, startTransition] = useTransition();
  const [summaryText, setSummaryText] = useState<string | null>(null);

  const handleOptimize = () => {
    startTransition(async () => {
      try {
        const summary = await optimizeScript(topicId, scriptId);
        setSummaryText(summary);
      } catch (error: any) {
        alert(error.message || 'Failed to optimize script');
      }
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={handleOptimize} disabled={isPending}>
        <Wand2 style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
        {isPending ? 'Optimizing...' : 'Optimize Script'}
      </Button>

      {summaryText && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '400px',
          maxWidth: '90vw',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#e5e7eb', fontSize: '1.1rem' }}>Optimization Summary</h4>
            <button onClick={() => setSummaryText(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflowY: 'auto' }}>
            <p style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>✓ Script updated successfully. Scenes are being regenerated safely.</p>
            {summaryText}
          </div>
        </div>
      )}
    </>
  );
}
