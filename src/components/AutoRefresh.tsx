'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoRefresh({ intervalMs = 10000, maxDurationMs = 120000 }: { intervalMs?: number; maxDurationMs?: number }) {
  const router = useRouter();
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      // Auto-stop after maxDuration to prevent runaway polling
      if (Date.now() - startTime.current > maxDurationMs) {
        clearInterval(interval);
        return;
      }
      router.refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [router, intervalMs, maxDurationMs]);

  return null;
}
