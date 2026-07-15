import React from 'react';
import styles from './page.module.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlayCircle, Video, Clock, TrendingUp, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Mock data for initial layout
  const stats = [
    { name: 'Total Videos', value: '12', icon: Video, change: '+2 this week' },
    { name: 'Active Jobs', value: '1', icon: Clock, change: 'Rendering...' },
    { name: 'Total Views', value: '14.2k', icon: TrendingUp, change: '+18% this week' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.welcome}>Welcome back, {user?.email?.split('@')[0] || 'Creator'}!</h2>
          <p className={styles.subtitle}>Here is what is happening with your channel today.</p>
        </div>
        <Button variant="primary" className={styles.actionButton}>
          <Plus className={styles.iconSm} />
          Create Video
        </Button>
      </header>

      <div className={styles.statsGrid}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardContent className={styles.statContent}>
                <div className={styles.statInfo}>
                  <p className={styles.statName}>{stat.name}</p>
                  <p className={styles.statValue}>{stat.value}</p>
                  <p className={styles.statChange}>{stat.change}</p>
                </div>
                <div className={styles.statIconWrapper}>
                  <Icon className={styles.statIcon} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className={styles.grid}>
        <Card className={styles.recentCard}>
          <CardHeader>
            <CardTitle>Recent Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.emptyState}>
              <PlayCircle className={styles.emptyIcon} />
              <p className={styles.emptyText}>No videos created yet.</p>
              <Button variant="secondary" size="sm">Create your first video</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card className={styles.activityCard}>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No recent activity to show.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
