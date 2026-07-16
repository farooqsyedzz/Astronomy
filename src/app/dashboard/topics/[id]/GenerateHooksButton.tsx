'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { generateMultipleHooks, applyHook } from '@/features/quality/actions';
import { Sparkles, Check, X } from 'lucide-react';

export function GenerateHooksButton({ topicId, scriptId }: { topicId: string, scriptId: string }) {
  const [isPending, startTransition] = useTransition();
  const [hooks, setHooks] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateMultipleHooks(topicId);
        setHooks(result);
      } catch (error: any) {
        alert(error.message || 'Failed to generate hooks');
      }
    });
  };

  const handleApply = (hookText: string) => {
    if (confirm('Replace the beginning of your script with this hook?')) {
      startTransition(async () => {
        try {
          await applyHook(topicId, scriptId, hookText);
          setHooks([]);
          setSuccessMessage('Hook applied successfully!\n\nYour script has changed. Existing scenes are outdated and will be regenerated.');
        } catch (error: any) {
          alert(error.message || 'Failed to apply hook');
        }
      });
    }
  };

  return (
    <div>
      <Button variant="secondary" onClick={handleGenerate} disabled={isPending}>
        <Sparkles style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
        {isPending && hooks.length === 0 ? 'Generating...' : 'Generate Hooks'}
      </Button>

      {successMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '400px',
          maxWidth: '90vw',
          backgroundColor: '#1f2937',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#10b981', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={20} />
              Success
            </h4>
            <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {successMessage}
          </p>
        </div>
      )}

      {hooks.length > 0 && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          backgroundColor: '#1f2937', padding: '2rem', borderRadius: '0.5rem',
          zIndex: 100, width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#f3f4f6' }}>Select a Hook</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {hooks.map((h, i) => (
              <div key={i} style={{ backgroundColor: '#111827', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 1rem 0', color: '#e5e7eb', fontSize: '1.1rem', lineHeight: 1.5 }}>"{h.hookText}"</p>
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}><em>Rationale: {h.rationale}</em></p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#10b98120', color: '#10b981', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 'bold' }}>
                      {h.predictedRetention} Score
                    </div>
                    <Button variant="primary" onClick={() => handleApply(h.hookText)} disabled={isPending}>
                      <Check style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setHooks([])} style={{ marginTop: '1.5rem', width: '100%' }}>
            Cancel
          </Button>
        </div>
      )}
      
      {hooks.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99 }} onClick={() => setHooks([])} />
      )}
    </div>
  );
}
