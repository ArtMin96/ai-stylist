import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// filament.js is a classic (non-module) script that fetches filament.wasm from the same
// directory it was loaded from. Serve both files under /filament/ straight out of
// node_modules in dev, and emit them into dist/filament/ on build.
const FILAMENT_DIR = path.join(import.meta.dirname, 'node_modules', 'filament');
const FILAMENT_FILES = {
  '/filament/filament.js': 'application/javascript',
  '/filament/filament.wasm': 'application/wasm',
};

function serveFilament() {
  return {
    name: 'serve-filament',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];
        const type = FILAMENT_FILES[url];
        if (!type) return next();
        res.setHeader('Content-Type', type);
        fs.createReadStream(path.join(FILAMENT_DIR, path.basename(url))).pipe(res);
      });
    },
    generateBundle() {
      for (const url of Object.keys(FILAMENT_FILES)) {
        const name = path.basename(url);
        this.emitFile({
          type: 'asset',
          fileName: `filament/${name}`,
          source: fs.readFileSync(path.join(FILAMENT_DIR, name)),
        });
      }
    },
  };
}

export default defineConfig({
  publicDir: '../assets', // /human.glb, /env/default_env_ibl.ktx, /env/default_env_skybox.ktx
  plugins: [serveFilament()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/files': 'http://127.0.0.1:8787',
    },
  },
});
