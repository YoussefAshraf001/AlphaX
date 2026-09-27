const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.otf': 'font/otf',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function safeAssetPath(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded.replace(/^[/\\]+/, '');
  const target = path.resolve(root, relative || 'index.html');
  const resolvedRoot = path.resolve(root);
  return target === resolvedRoot || target.startsWith(`${resolvedRoot}${path.sep}`) ? target : null;
}

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      let target = safeAssetPath(root, pathname);
      if (!target) { response.writeHead(400).end('Bad request'); return; }
      try {
        if (!fs.statSync(target).isFile()) target = path.join(root, 'index.html');
      } catch { target = path.join(root, 'index.html'); }
      fs.readFile(target, (error, bytes) => {
        if (error) { response.writeHead(404).end('Not found'); return; }
        const extension = path.extname(target).toLowerCase();
        response.writeHead(200, {
          'Content-Type': contentTypes[extension] || 'application/octet-stream',
          'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        });
        response.end(bytes);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

module.exports = { safeAssetPath, startStaticServer };
