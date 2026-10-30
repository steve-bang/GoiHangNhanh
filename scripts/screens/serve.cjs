'use strict';
/**
 * Máy chủ tĩnh tối giản cho bản web đã xuất (SPA: route không có tệp trả `index.html`). Chỉ nghe
 * 127.0.0.1, chỉ GET/HEAD. Dùng nội bộ bởi capture.cjs; không phải máy chủ cho người dùng.
 */
const fs = require('node:fs');
const http = require('node:http');
const { contentTypeFor, resolveStaticFile } = require('./lib.cjs');

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Mở máy chủ cho `root` ở `port`; trả `{ url, close() }`. Cổng bận -> lỗi rõ ràng. */
function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const file = resolveStaticFile(root, req.url ?? '/', isFile);
    if (!file || !isFile(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypeFor(file), 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(`Cổng ${port} đang bận: chọn cổng khác bằng --port`)
          : err,
      );
    });
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

module.exports = { startStaticServer };
