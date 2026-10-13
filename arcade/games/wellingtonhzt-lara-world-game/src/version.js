export const APP_VERSION = 'v1.0.0';

export function getCacheBust() {
  return `v=${encodeURIComponent(APP_VERSION)}`;
}
