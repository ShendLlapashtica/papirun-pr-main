// Native bridge utilities — graceful fallback to web APIs when not running in Capacitor.
// Use these everywhere instead of importing Capacitor plugins directly.

import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/* ----------------------------- HAPTICS ----------------------------- */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

export const haptic = async (style: HapticStyle = 'light') => {
  // Native path
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      switch (style) {
        case 'light':   return Haptics.impact({ style: ImpactStyle.Light });
        case 'medium':  return Haptics.impact({ style: ImpactStyle.Medium });
        case 'heavy':   return Haptics.impact({ style: ImpactStyle.Heavy });
        case 'success': return Haptics.notification({ type: NotificationType.Success });
        case 'warning': return Haptics.notification({ type: NotificationType.Warning });
        case 'error':   return Haptics.notification({ type: NotificationType.Error });
        case 'select':  return Haptics.selectionStart();
      }
    } catch {}
  }
  // Web fallback — Vibration API (works on most Android browsers)
  try {
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
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }); // dark icons on light bg
    await StatusBar.setBackgroundColor({ color: '#F4F9F6' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {}
};

/* ----------------------------- SHARE ----------------------------- */

export const nativeShare = async (opts: { title?: string; text?: string; url?: string; dialogTitle?: string }) => {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: opts.title ?? 'Papirun',
        text: opts.text ?? '',
        url: opts.url ?? 'https://papirun.online',
        dialogTitle: opts.dialogTitle ?? 'Shpërnda',
      });
      return true;
    } catch { return false; }
  }
  // Web Share API
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      await (navigator as any).share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    }
  } catch {}
  return false;
};

/* ----------------------------- BACK BUTTON LOCK ----------------------------- */
// Lock Android hardware back button while a critical overlay is up.

let backLockListenerHandle: any = null;

export const lockBackButton = async () => {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    if (backLockListenerHandle) return;
    backLockListenerHandle = await App.addListener('backButton', () => { /* swallow */ });
  } catch {}
};

export const unlockBackButton = async () => {
  if (!isNative()) return;
  try {
    if (backLockListenerHandle) {
      await backLockListenerHandle.remove();
      backLockListenerHandle = null;
    }
  } catch {}
};
