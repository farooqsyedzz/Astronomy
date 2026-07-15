'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createTopicAndResearch } from '@/features/topics/actions';
import styles from './newTopic.module.css';
import { Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTopicPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const formData = new FormData(e.currentTarget);
      await createTopicAndResearch(formData);
      // It redirects on success, so we don't need to unset isSubmitting ideally,
      // but in case of error we must handle it.
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the topic');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/dashboard/topics" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} />
        Back to Topics
      </Link>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Create New Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.description}>
              Enter a topic and Gemini will automatically research it, 
              identify the target audience, search intent, and suggest titles.
            </p>

            <div className={styles.inputGroup}>
              <label htmlFor="title">Topic Idea</label>
              <input 
                id="title" 
                name="title" 
                type="text" 
                placeholder="e.g. The James Webb Space Telescope Discoveries"
                required 
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button 
              type="submit" 
              variant="primary" 
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              <Sparkles className={styles.iconSm} />
              {isSubmitting ? 'Researching...' : 'Generate Research'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
