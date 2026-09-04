# G3 spike viewer (Filament WebAssembly)

Vite single-page viewer that renders the human GLB and template garments with Google
Filament's official WebAssembly build (`filament@1.53.4`, gltfio). No three.js.

```
npm install
npm run dev        # http://127.0.0.1:5173, proxies /api and /files to 127.0.0.1:8787
                   # (if 5173 is taken Vite picks the next free port; pass --port to pin one)
npm run build      # dist/
```

## How filament.js / filament.wasm are served

`filament.js` is a classic script that defines a global `Filament` and fetches
`filament.wasm` from the directory it was loaded from. `vite.config.js` has a tiny plugin
(`serveFilament`) that

- in dev, serves `/filament/filament.js` and `/filament/filament.wasm` straight from
  `node_modules/filament/` via a middleware, and
- on build, emits both files into `dist/filament/`.

`index.html` loads `<script src="/filament/filament.js">` before the module `main.js`.
Nothing is copied into git-tracked directories.

## Assets

`publicDir` is `../assets`, so `/human.glb`, `/env/default_env_ibl.ktx` and
`/env/default_env_skybox.ktx` come from the orchestrator-owned `assets/` directory.
The two KTX files are preloaded through `Filament.init([...])` and used with
`engine.createIblFromKtx1` / `createSkyFromKtx1`. Dynamically loaded GLBs are fetched
into a `Uint8Array` and passed to `AssetLoader.createAsset` directly.

## Behaviour

- On load: `GET /api/human`, load the GLB, frame the camera on its bounding box.
- Wear / Take off keep one garment per `slot`; any change does `POST /api/dress`
  and swaps the displayed asset (previous asset destroyed with `destroyAsset`).
- View alone loads that garment's `urls.glb`; "Back to human" returns.
- Orbit: drag (yaw + clamped pitch), wheel zoom, plain camera math with `camera.lookAt`.
- Lighting: IBL + skybox from the KTX files plus one directional sun with shadows.
- Handles resize and devicePixelRatio; FPS readout in the panel.
