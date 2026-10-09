// apps/api/src/index.ts
// Server entry point.
// Importing config.ts triggers env validation — exits immediately with a
// non-zero code if JWT_SECRET is missing, before any server socket is opened.
import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port} (${config.nodeEnv})`);
});
