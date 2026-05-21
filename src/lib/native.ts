// Web-only native bridge — all functions are safe no-ops or web-API fallbacks.

export const isNative = (): boolean => false;

/* ----------------------------- HAPTICS ----------------------------- */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

export const haptic = async (style: HapticStyle = 'light') => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = style === 'heavy' ? 30 : style === 'medium' ? 18 : style === 'success' ? [10, 40, 10] : 10;
      // @ts-ignore
      navigator.vibrate(ms);
    }
  } catch {}
};

/* ----------------------------- STATUS BAR ----------------------------- */

export const initStatusBar = async () => { /* web — no-op */ };

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

/* ----------------------------- BACK BUTTON LOCK ----------------------------- */

export const lockBackButton = async () => { /* web — no-op */ };
export const unlockBackButton = async () => { /* web — no-op */ };
