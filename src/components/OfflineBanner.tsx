import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs font-medium"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
        <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          You are offline. Logged meals are cached locally and will sync when you reconnect.
        </span>
      </div>
    </div>
  );
};
