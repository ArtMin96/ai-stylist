// Composition root, part 2: build the app (app.module.ts) and listen on the configured port.
import 'reflect-metadata';

import { createApp } from './app.module.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp({ config });
await app.listen({ port: config.listenPort, host: '0.0.0.0' });
