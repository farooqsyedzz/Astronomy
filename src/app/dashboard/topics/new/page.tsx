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

            <div className={styles.inputGroup}>
              <label htmlFor="sceneCount">Target Scene Count</label>
              <select 
                id="sceneCount"
                name="sceneCount"
                className={styles.input}
                defaultValue="10"
                disabled={isSubmitting}
              >
                <option value="8">8 Scenes (Short)</option>
                <option value="10">10 Scenes (Standard)</option>
                <option value="12">12 Scenes (Standard)</option>
                <option value="15">15 Scenes (Long)</option>
                <option value="20">20 Scenes (Very Long)</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="sentencesPerScene">Sentences Per Scene</label>
              <select 
                id="sentencesPerScene"
                name="sentencesPerScene"
                className={styles.input}
                defaultValue="2-3"
                disabled={isSubmitting}
              >
                <option value="1-2">1-2 sentences (Fast Paced)</option>
                <option value="2-3">2-3 sentences (Standard)</option>
                <option value="3-4">3-4 sentences (Detailed)</option>
              </select>
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
