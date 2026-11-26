import React from 'react';
import { useOnlineStatus } from '../utils/pwa.ts';

export interface OfflineIndicatorProps {
  isUsingOfflineData?: boolean;
  onRetrySync?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isUsingOfflineData = false,
  onRetrySync
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && !isUsingOfflineData) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-4 left-3 sm:left-4 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 text-white border border-[#d4af37]/60 shadow-lg backdrop-blur-sm text-[11px] font-semibold select-none"
    >
      <span className="w-2 h-2 rounded-full bg-[#d4af37] shrink-0" />
      <span>{!isOnline ? 'Mode hors ligne' : 'Mode hors ligne • Données locales'}</span>
      {isOnline && onRetrySync && (
        <button
          type="button"
          onClick={onRetrySync}
          className="ml-1 px-1.5 py-0.5 rounded-md bg-[#d4af37] hover:bg-[#c19c27] text-slate-950 font-extrabold text-[10px] cursor-pointer transition-colors"
        >
          Synchroniser
        </button>
      )}
    </div>
  );
};
