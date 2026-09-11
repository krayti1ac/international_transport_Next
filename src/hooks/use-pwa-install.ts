'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

const SESSION_DISMISSED_KEY = 'tb_pwa_dismissed_session';

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    nav.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function getInitialIsOpen(): boolean {
  if (typeof window === 'undefined') return false;
  if (getIsStandalone()) return false;
  try {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function usePwaInstall() {
  const isClient = useIsClient();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(getIsStandalone);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean>(getInitialIsOpen);

  const [platform] = useState<'windows' | 'mac' | 'ios' | 'android' | 'other'>(() => {
    if (typeof window === 'undefined') return 'windows';
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac') && !ua.includes('iphone') && !ua.includes('ipad')) return 'mac';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    if (ua.includes('android')) return 'android';
    return 'other';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker to satisfy PWA criteria
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.debug('PWA ServiceWorker registration note:', err);
      });
    }

    // 1. Listen for the native beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);

      try {
        if (sessionStorage.getItem(SESSION_DISMISSED_KEY) !== 'true') {
          setIsOpen(true);
        }
      } catch {
        setIsOpen(true);
      }
    };

    // 2. Listen for appinstalled event (fired once user installs the PWA)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsOpen(false);
      try {
        sessionStorage.removeItem(SESSION_DISMISSED_KEY);
      } catch {}
    };

    // 3. Listen for display-mode media query changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
        setIsOpen(false);
      } else {
        setIsInstalled(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  // Trigger the installation flow
  const showPrompt = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        setIsOpen(false);
        try {
          sessionStorage.removeItem(SESSION_DISMISSED_KEY);
        } catch {}
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to trigger PWA prompt:', err);
      return false;
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  // Dismiss for current browser session
  const dismissPrompt = useCallback(() => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true');
    } catch {}
  }, []);

  const openPrompt = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isInstalling,
    isOpen,
    isReady: isClient,
    platform,
    hasDeferredPrompt: !!deferredPrompt,
    showPrompt,
    dismissPrompt,
    openPrompt,
    setIsOpen,
  };
}
