const test = require('node:test');
const assert = require('node:assert/strict');
const { localDevelopmentOrigin, isAppUrl, isExternalUrl, isTrustedMediaUrl, canGrantPermission, canOpenWindowFrom } = require('../src/policy.cjs');

const origin = 'http://127.0.0.1:43123';
test('development URLs are restricted to local HTTP servers', () => {
  assert.equal(localDevelopmentOrigin('http://localhost:3000/movies'), 'http://localhost:3000');
  assert.equal(localDevelopmentOrigin('https://localhost:3000'), null);
  assert.equal(localDevelopmentOrigin('http://example.com:3000'), null);
});
test('only the exact local app origin is trusted', () => {
  assert.equal(isAppUrl(`${origin}/movies/12`, origin), true);
  assert.equal(isAppUrl('http://127.0.0.1:43124', origin), false);
  assert.equal(isAppUrl(`http://user@127.0.0.1:43123`, origin), false);
});
test('safe external protocols are accepted', () => {
  assert.equal(isExternalUrl('https://www.themoviedb.org/movie/1'), true);
  assert.equal(isExternalUrl('javascript:alert(1)'), false);
});
test('permissions are minimal and origin-bound', () => {
  assert.equal(canGrantPermission('fullscreen', origin, origin), true);
  assert.equal(canGrantPermission('fullscreen', 'https://www.youtube.com/embed/video', origin), true);
  assert.equal(canGrantPermission('fullscreen', 'https://www.vidy.st/embed/movie/12', origin), true);
  assert.equal(canGrantPermission('media', origin, origin), false);
  assert.equal(canGrantPermission('fullscreen', 'https://example.com', origin), false);
  assert.equal(canGrantPermission('clipboard-sanitized-write', 'https://www.youtube.com', origin), false);
});
test('trusted media matching cannot be bypassed with lookalike hosts', () => {
  assert.equal(isTrustedMediaUrl('https://youtube.com/embed/video'), true);
  assert.equal(isTrustedMediaUrl('https://evil-youtube.com/embed/video'), false);
  assert.equal(isTrustedMediaUrl('https://vidy.st.evil.example/embed/video'), false);
  assert.equal(isTrustedMediaUrl('http://www.vidy.st/embed/video'), false);
});
test('only the main app can open a new browser window', () => {
  assert.equal(canOpenWindowFrom(`${origin}/movies/12`, origin), true);
  assert.equal(canOpenWindowFrom('https://www.vidy.st/embed/movie/12', origin), false);
  assert.equal(canOpenWindowFrom('https://www.youtube.com/embed/video', origin), false);
  assert.equal(canOpenWindowFrom('', origin), false);
});
