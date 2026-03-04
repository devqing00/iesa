'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * GrowthSyncBadge — Small status indicator for Growth Hub tools.
 * Shows "Offline — saved locally" when disconnected,
 * or "Synced" when online. Fades in/out on status change.
 */
export default function GrowthSyncBadge() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] border-[2px] transition-all duration-300 ${
        isOnline
          ? 'bg-teal-light text-teal border-teal/30'
          : 'bg-coral-light text-coral border-coral/30'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isOnline ? 'bg-teal animate-pulse' : 'bg-coral'
        }`}
      />
      {isOnline ? 'Synced' : 'Offline — saved locally'}
    </div>
  );
}
