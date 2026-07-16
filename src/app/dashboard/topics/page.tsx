import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Search, FileText } from 'lucide-react';
import styles from './topics.module.css';

import { DeleteTopicButton } from './DeleteTopicButton';

export default async function TopicsPage() {
  const supabase = await createClient();
  
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Topics</h2>
        <Link href="/dashboard/topics/new">
          <Button variant="primary">
            <Plus className={styles.iconSm} />
            New Topic
          </Button>
        </Link>
      </header>

      {(!topics || topics.length === 0) ? (
        <div className={styles.emptyState}>
          <Search className={styles.emptyIcon} />
          <h3>No topics found</h3>
          <p>Get started by creating a new topic for your next video.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {topics.map((topic) => (
            <Link key={topic.id} href={`/dashboard/topics/${topic.id}`}>
              <Card className={styles.topicCard}>
                <CardHeader style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>{topic.title}</CardTitle>
                  <DeleteTopicButton topicId={topic.id} compact={true} />
                </CardHeader>
                <CardContent>
                  <div className={styles.meta}>
                    <span className={styles.statusBadge} data-status={topic.status}>
                      {topic.status.replace('_', ' ')}
                    </span>
                    <span className={styles.date}>
                      {new Date(topic.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
