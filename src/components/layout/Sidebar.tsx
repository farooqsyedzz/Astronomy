'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Library,
  BarChart2,
  Settings,
  Rocket
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Topics', href: '/dashboard/topics', icon: Library },
  { name: 'Videos', href: '/dashboard/videos', icon: Video },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <Rocket className={styles.logoIcon} />
        <span className={styles.logoText}>AI Studio</span>
      </div>
      
      <nav className={styles.nav}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon className={styles.icon} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
