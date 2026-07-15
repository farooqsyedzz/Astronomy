'use client';

import React from 'react';
import { User, Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './Navbar.module.css';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
      </div>
      
      <div className={styles.right}>
        <Button variant="primary" size="sm" className={styles.newVideoButton}>
          <Plus className={styles.iconSm} />
          New Video
        </Button>
        
        <button className={styles.iconButton}>
          <Bell className={styles.icon} />
        </button>
        
        <div className={styles.userMenu}>
          <button className={styles.iconButton} onClick={handleLogout} title="Log out">
            <User className={styles.icon} />
          </button>
        </div>
      </div>
    </header>
  );
}
