const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { safeAssetPath } = require('../src/static-server.cjs');

test('asset paths remain inside the web root', () => {
  const root = path.resolve('example-web-root');
  assert.equal(safeAssetPath(root, '/static/js/main.js'), path.join(root, 'static/js/main.js'));
  assert.equal(safeAssetPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(safeAssetPath(root, '/../secret.txt'), null);
  assert.equal(safeAssetPath(root, '/%E0%A4%A'), null);
});
