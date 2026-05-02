import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Serves .webp instead of .jpg if the image was already prepared in storage.
 */
export function getOptimizedImage(url: string | undefined | null) {
  if (!url) return '';
  return url.replace(/\.jpg$/i, '.webp');
}

