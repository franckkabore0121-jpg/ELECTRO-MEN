import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

declare global {
  interface Window {
    __electromenDeferredPrompt?: BeforeInstallPromptEvent | null;
    __electromenPwaInstalled?: boolean;
  }
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    nav.standalone === true ||
    window.__electromenPwaInstalled === true
  );
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleTouch =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAppleTouch;
}

let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();
const installedListeners = new Set<(installed: boolean) => void>();

function notifyPromptListeners(nextPrompt: BeforeInstallPromptEvent | null): void {
  sharedDeferredPrompt = nextPrompt;
  if (typeof window !== 'undefined') {
    window.__electromenDeferredPrompt = nextPrompt;
  }
  promptListeners.forEach((cb) => cb(nextPrompt));
}

function notifyInstalledListeners(installed: boolean): void {
  if (typeof window !== 'undefined') {
    window.__electromenPwaInstalled = installed;
  }
  installedListeners.forEach((cb) => cb(installed));
}

let pwaListenersInitialized = false;

export function initPWAListeners(): void {
  if (typeof window === 'undefined' || pwaListenersInitialized) return;
  pwaListenersInitialized = true;

  if (window.__electromenDeferredPrompt) {
    sharedDeferredPrompt = window.__electromenDeferredPrompt;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    notifyPromptListeners(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('electromen:pwa-prompt-ready', () => {
    if (window.__electromenDeferredPrompt) {
      notifyPromptListeners(window.__electromenDeferredPrompt);
    }
  });

  window.addEventListener('appinstalled', () => {
    notifyPromptListeners(null);
    notifyInstalledListeners(true);
  });

  window.addEventListener('electromen:pwa-installed', () => {
    notifyPromptListeners(null);
    notifyInstalledListeners(true);
  });
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === 'undefined') return null;
    return sharedDeferredPrompt || window.__electromenDeferredPrompt || null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningStandalone());
  const [isIOS] = useState<boolean>(() => isIOSDevice());

  useEffect(() => {
    initPWAListeners();

    // Sync any prompt captured early in index.html before React hydrated
    if (typeof window !== 'undefined' && window.__electromenDeferredPrompt) {
      setDeferredPrompt(window.__electromenDeferredPrompt);
    }
    if (isRunningStandalone()) {
      setIsInstalled(true);
    }

    const onPrompt = (next: BeforeInstallPromptEvent | null) => setDeferredPrompt(next);
    const onInstalled = (installed: boolean) => setIsInstalled(installed);

    promptListeners.add(onPrompt);
    installedListeners.add(onInstalled);

    const mediaQuery =
      typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)') : null;
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        notifyPromptListeners(null);
      }
    };
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      promptListeners.delete(onPrompt);
      installedListeners.delete(onInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const promptEvent =
      deferredPrompt ||
      sharedDeferredPrompt ||
      (typeof window !== 'undefined' ? window.__electromenDeferredPrompt : null);

    if (!promptEvent) {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        notifyPromptListeners(null);
        notifyInstalledListeners(true);
        return 'accepted';
      }
      // Chrome consumes the prompt even on dismiss; clear so fallback or next event handles cleanly
      notifyPromptListeners(null);
      return 'dismissed';
    } catch {
      notifyPromptListeners(null);
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    canNativeInstall: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install
  };
}
