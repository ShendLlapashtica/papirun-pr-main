// Native bridge — real Capacitor implementations with web-safe fallbacks.
// Every function behaves exactly as before in a browser; native behavior
// activates only inside the Capacitor app (Capacitor.isNativePlatform()).

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/* ----------------------------- HAPTICS ----------------------------- */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

export const haptic = async (style: HapticStyle = 'light') => {
  try {
    if (isNative()) {
      if (style === 'success' || style === 'warning' || style === 'error') {
        await Haptics.notification({ type: style === 'success' ? NotificationType.Success : style === 'warning' ? NotificationType.Warning : NotificationType.Error });
      } else if (style === 'select') {
        await Haptics.selectionStart();
        await Haptics.selectionEnd();
      } else {
        await Haptics.impact({ style: style === 'heavy' ? ImpactStyle.Heavy : style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
      }
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = style === 'heavy' ? 30 : style === 'medium' ? 18 : style === 'success' ? [10, 40, 10] : 10;
      // @ts-ignore
      navigator.vibrate(ms);
    }
  } catch {}
};

/* ----------------------------- STATUS BAR ----------------------------- */

export const initStatusBar = async () => {
  if (!isNative()) return;
  try {
    // Light sage background → dark status-bar icons, no overlay (content
    // handles safe-area itself via env(safe-area-inset-top)).
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F4F9F6' });
  } catch {}
};

/* ----------------------------- SHARE ----------------------------- */

export const nativeShare = async (opts: { title?: string; text?: string; url?: string; dialogTitle?: string }) => {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      await (navigator as any).share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    }
  } catch {}
  return false;
};

/* ----------------------------- EXTERNAL LINKS ----------------------------- */

// All outbound links (WhatsApp, Google Maps, …) must go through here.
// Native: system browser via the Capacitor Browser plugin (window.open is
// unreliable in WebViews). Web: normal new-tab open.
export const openExternal = (url: string) => {
  if (isNative()) {
    Browser.open({ url }).catch(() => {});
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

/* ----------------------------- BACK BUTTON LOCK ----------------------------- */

// Android hardware back: navigate back within the SPA; minimize the app
// instead of closing it when there's nowhere left to go.
export const initAndroidBackButton = () => {
  if (!isNative()) return;
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.minimizeApp().catch(() => {});
  });
};

export const lockBackButton = async () => { /* handled by initAndroidBackButton */ };
export const unlockBackButton = async () => { /* handled by initAndroidBackButton */ };
