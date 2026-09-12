'use client';

import { submitReport } from '@/lib/api';

export interface QueuedReport {
  clientId: string;
  payload: {
    text: string;
    district?: string;
    village?: string;
    people_est?: number;
    reporter_name?: string;
    vulnerable?: string[];
    photo_urls?: string[];
  };
  createdAt: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  attempts: number;
}

const STORAGE_KEY = 'jharsetu_offline_reports_v1';

export function getQueuedReports(): QueuedReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueuedReports(reports: QueuedReport[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error('Failed to save offline queue to localStorage', err);
  }
}

export function enqueueOfflineReport(payload: QueuedReport['payload']): QueuedReport {
  const clientId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: QueuedReport = {
    clientId,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };

  const current = getQueuedReports();
  // Filter out any older duplicate with same client_id if any
  const updated = [item, ...current];
  saveQueuedReports(updated);

  // Trigger sync in background if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(flushOfflineQueue, 100);
  }

  return item;
}

export async function flushOfflineQueue(): Promise<{ sent: number; failed: number }> {
  if (typeof window === 'undefined') return { sent: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { sent: 0, failed: 0 };
  }

  const reports = getQueuedReports();
  const pending = reports.filter((r) => r.status === 'pending' || r.status === 'failed');

  if (pending.length === 0) return { sent: 0, failed: 0 };

  let sentCount = 0;
  let failedCount = 0;

  for (const item of pending) {
    // Mark as sending
    item.status = 'sending';
    item.attempts += 1;
    saveQueuedReports(reports);

    try {
      await submitReport({
        ...item.payload,
        client_id: item.clientId,
      });

      item.status = 'sent';
      item.error = undefined;
      sentCount++;
    } catch (err: any) {
      item.status = 'failed';
      item.error = err?.message || 'Network submission error';
      failedCount++;
    }
    saveQueuedReports(reports);
  }

  return { sent: sentCount, failed: failedCount };
}

/**
 * Setup listener to auto-sync when network returns
 */
export function setupOfflineSyncListener(onSyncComplete?: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    await flushOfflineQueue();
    onSyncComplete?.();
  };

  window.addEventListener('online', handleOnline);

  // Also check periodically
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      const res = await flushOfflineQueue();
      if (res.sent > 0 && onSyncComplete) {
        onSyncComplete();
      }
    }
  }, 15000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}
