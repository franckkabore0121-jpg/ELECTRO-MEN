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
      className="fixed bottom-20 lg:bottom-4 left-3 right-3 sm:right-auto sm:max-w-lg sm:left-4 z-40 inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/95 text-white border border-[#d4af37]/60 shadow-lg backdrop-blur-sm text-[11px] font-semibold"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[#d4af37] shrink-0" />
        <span className="leading-snug">
          {isOnline
            ? 'Affichage depuis le cache récent — La synchronisation en direct reprendra automatiquement'
            : 'Mode hors ligne / catalogue enregistré — La synchronisation en direct reprendra automatiquement'}
        </span>
      </div>
      {isOnline && onRetrySync && (
        <button
          type="button"
          onClick={onRetrySync}
          className="ml-1 px-2 py-1 rounded-md bg-[#d4af37] hover:bg-[#c19c27] text-slate-950 font-extrabold text-[10px] cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          Actualiser le catalogue
        </button>
      )}
    </div>
  );
};
