export function getMediaUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return url;

  return `${window.location.protocol}//${window.location.hostname}:3000${url}`;
}