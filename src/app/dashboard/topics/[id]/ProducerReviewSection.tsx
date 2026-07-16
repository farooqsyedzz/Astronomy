'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { runProducerReview } from '@/features/quality/actions';
import { Activity } from 'lucide-react';

export function ProducerReviewSection({ topicId, initialScore, reviews }: { topicId: string, initialScore: number | null, reviews: any[] }) {
  const [isPending, startTransition] = useTransition();

  const handleReview = () => {
    startTransition(async () => {
      try {
        await runProducerReview(topicId);
      } catch (error: any) {
        alert(error.message || 'Failed to run producer review');
      }
    });
  };

  const latestReview = reviews && reviews.length > 0 ? reviews[0] : null;

  let scoreColor = '#10b981'; // Green
  let badgeLabel = 'Ready to Publish';
  if (initialScore !== null) {
    if (initialScore < 60) {
      scoreColor = '#ef4444'; // Red
      badgeLabel = 'Strong Warning';
    } else if (initialScore < 80) {
      scoreColor = '#f97316'; // Orange
      badgeLabel = 'Significant Improvements Suggested';
    } else if (initialScore < 90) {
      scoreColor = '#eab308'; // Yellow
      badgeLabel = 'Good, but improvements recommended';
    }
  }

  return (
    <Card style={{ marginBottom: '2rem', border: initialScore !== null ? `1px solid ${scoreColor}` : undefined }}>
      <CardHeader style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity style={{ color: scoreColor }} />
          Producer Review & Readiness
        </CardTitle>
        <Button onClick={handleReview} disabled={isPending} variant="secondary">
          {isPending ? 'Reviewing...' : 'Run Producer Review'}
        </Button>
      </CardHeader>
      <CardContent>
        {initialScore === null ? (
          <p style={{ color: '#9ca3af' }}>No readiness score yet. Run a producer review to evaluate your content.</p>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: scoreColor }}>{initialScore}/100</div>
              <div style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: scoreColor + '20', color: scoreColor, fontWeight: 500, fontSize: '0.875rem' }}>
                {badgeLabel}
              </div>
            </div>
            
            {latestReview && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><strong>Hook:</strong> {latestReview.hook_score}/100</div>
                <div><strong>Storytelling:</strong> {latestReview.storytelling_score}/100</div>
                <div><strong>Accuracy:</strong> {latestReview.accuracy_score}/100</div>
                <div><strong>Retention:</strong> {latestReview.retention_score}/100</div>
                <div><strong>SEO:</strong> {latestReview.seo_score}/100</div>
              </div>
            )}
            
            {latestReview?.feedback && latestReview.feedback.length > 0 && (
              <div style={{ backgroundColor: '#1f2937', padding: '1rem', borderRadius: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#e5e7eb' }}>Actionable Feedback:</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#d1d5db' }}>
                  {latestReview.feedback.map((f: string, i: number) => (
                    <li key={i} style={{ marginBottom: '0.25rem' }}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
