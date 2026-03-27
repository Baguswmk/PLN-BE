'use strict';

const fs = require('fs');

const _originalUnlink = fs.unlink.bind(fs);
const _unlinkWithRetry = (path, callback, retries = 3) => {
  _originalUnlink(path, (err) => {
    if (err && err.code === 'EBUSY' && retries > 0) {
      setTimeout(() => _unlinkWithRetry(path, callback, retries - 1), 100 * (4 - retries));
    } else {
      // Jika tetap EBUSY setelah semua retry, abaikan saja (file sementara akan dibersihkan OS)
      if (err && err.code !== 'EBUSY' && err.code !== 'ENOENT') {
        callback(err);
      } else {
        callback(null);
      }
    }
  });
};
fs.unlink = (path, callback) => _unlinkWithRetry(path, callback);
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  register(/*{ strapi }*/) {},
  bootstrap(/*{ strapi }*/) {},
};

