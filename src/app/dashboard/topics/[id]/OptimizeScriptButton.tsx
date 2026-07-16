'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { optimizeScript } from '@/features/quality/actions';
import { Wand2, X } from 'lucide-react';

export function OptimizeScriptButton({ topicId, scriptId }: { topicId: string, scriptId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ summary: string, originalScript: string, newScript: string } | null>(null);

  const handleOptimize = () => {
    startTransition(async () => {
      try {
        const response = await optimizeScript(topicId, scriptId);
        setResult(response);
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

      {result && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '800px',
          maxWidth: '90vw',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#e5e7eb', fontSize: '1.1rem' }}>Optimization Summary</h4>
            <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.5', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ color: '#10b981', marginBottom: '0.5rem', fontWeight: 'bold' }}>✓ Script updated & optimized successfully.</p>
              <p style={{ fontStyle: 'italic', color: '#9ca3af' }}>{result.summary}</p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, backgroundColor: '#111827', padding: '1rem', borderRadius: '0.25rem', border: '1px solid #374151' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#f87171' }}>Original Script</h5>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#9ca3af' }}>
                  {result.originalScript.substring(0, 500)}...
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#111827', padding: '1rem', borderRadius: '0.25rem', border: '1px solid #374151' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#34d399' }}>Optimized Script</h5>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#d1d5db' }}>
                  {result.newScript.substring(0, 500)}...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
