// Node.js 18 does not expose File as a global (added in v20+).
// undici (used by testcontainers) requires it globally.
if (typeof globalThis.File === 'undefined') {
  const { File } = require('buffer');
  globalThis.File = File;
}
