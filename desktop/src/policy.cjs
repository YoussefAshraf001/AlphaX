function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function localDevelopmentOrigin(value) {
  const url = parseUrl(value);
  const localHost = url && ['localhost', '127.0.0.1'].includes(url.hostname);
  return url?.protocol === 'http:' && localHost && !url.username && !url.password ? url.origin : null;
}

function isAppUrl(value, appOrigin) {
  const url = parseUrl(value);
  return Boolean(url && url.origin === appOrigin && !url.username && !url.password);
}

function isExternalUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password);
}

function isTrustedMediaUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || url.username || url.password) return false;
  return ['youtube.com', 'youtube-nocookie.com', 'vidy.st'].some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
}

function canGrantPermission(permission, origin, appOrigin) {
  if (permission === 'fullscreen') return isAppUrl(origin, appOrigin) || isTrustedMediaUrl(origin);
  return permission === 'clipboard-sanitized-write' && isAppUrl(origin, appOrigin);
}

function canOpenWindowFrom(referrer, appOrigin) {
  return isAppUrl(referrer, appOrigin);
}

module.exports = { localDevelopmentOrigin, isAppUrl, isExternalUrl, isTrustedMediaUrl, canGrantPermission, canOpenWindowFrom };
