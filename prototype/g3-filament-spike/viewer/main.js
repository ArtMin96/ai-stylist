// G3 Filament spike viewer. Renders with Google Filament's WebAssembly build (global
// `Filament` from /filament/filament.js). No three.js.

const IBL_URL = '/env/default_env_ibl.ktx';
const SKY_URL = '/env/default_env_skybox.ktx';
const HONESTY_LABEL = 'Template 3D · approximate';
const FOV_DEG = 35;
const CHEST_Y = 1.2; // default look-at height for the human view (1.80 m human), metres
const CHEST_PITCH = 0.2; // radians above the target = slight downward view

// ---------------------------------------------------------------- API ------

async function json(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

const api = {
  human: () => fetch('/api/human').then(json),
  garments: () => fetch('/api/garments').then(json),
  build({ front, back, side }, category) {
    const body = new FormData();
    body.append('image', front);
    if (back) body.append('image_back', back);
    if (side) body.append('image_side', side);
    body.append('category', category);
    return fetch('/api/garments', { method: 'POST', body }).then(json);
  },
  dress(garmentIds) {
    return fetch('/api/dress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ garmentIds }),
    }).then(json);
  },
};

// ---------------------------------------------------------------- DOM ------

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const statusEl = $('status');
const fpsEl = $('fps');
const listEl = $('garments');
const backBtn = $('back');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  if (isError) console.error(text);
}

// ---------------------------------------------------------------- state ----

let humanUrl = null;
const garments = []; // objects from POST/GET /api/garments
const worn = new Map(); // slot -> garment id
let mode = 'human'; // 'human' | 'alone'
let aloneId = null;

// ---------------------------------------------------------------- Filament -

let engine, scene, view, camera, renderer, swapChain, loader;
let currentAsset = null;
let loadToken = 0;

const orbit = { yaw: 0, pitch: CHEST_PITCH, dist: 4, target: [0, CHEST_Y, 0] };
const MIN_PITCH = -1.4, MAX_PITCH = 1.4;

function setupFilament() {
  engine = Filament.Engine.create(canvas);
  scene = engine.createScene();

  const ibl = engine.createIblFromKtx1(IBL_URL);
  ibl.setIntensity(30000);
  scene.setIndirectLight(ibl);
  scene.setSkybox(engine.createSkyFromKtx1(SKY_URL));

  // Sun from front-above-right; the human faces +Z.
  const sun = Filament.EntityManager.get().create();
  Filament.LightManager.Builder(Filament.LightManager$Type.DIRECTIONAL)
    .color([1, 0.97, 0.92])
    .intensity(90000)
    .direction(normalize([0.4, -0.8, -0.6]))
    .castShadows(true)
    .build(engine, sun);
  scene.addEntity(sun);

  camera = engine.createCamera(Filament.EntityManager.get().create());
  swapChain = engine.createSwapChain();
  renderer = engine.createRenderer();
  view = engine.createView();
  view.setCamera(camera);
  view.setScene(scene);
  // Quality: SSAO + 4x MSAA + TAA (all exposed by filament.d.ts 1.53.4; set once, before
  // the first frame, because TAA changes recompile post-process shaders). Shadows stay on
  // (sun castShadows above). Guard band suppresses SSAO artifacts at the screen edge.
  view.setAmbientOcclusionOptions({ enabled: true, radius: 0.3, power: 1.0, bias: 0.0005 });
  view.setMultiSampleAntiAliasingOptions({ enabled: true, sampleCount: 4 });
  view.setTemporalAntiAliasingOptions({ enabled: true, feedback: 0.12, filterWidth: 1.0 });
  view.setGuardBandOptions({ enabled: true });

  loader = engine.createAssetLoader();

  window.addEventListener('resize', resize);
  resize();
  setupOrbit();
  requestAnimationFrame(frame);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  canvas.width = w;
  canvas.height = h;
  view.setViewport([0, 0, w, h]);
  const aspect = w / h;
  const fovDir = aspect < 1 ? Filament.Camera$Fov.HORIZONTAL : Filament.Camera$Fov.VERTICAL;
  camera.setProjectionFov(FOV_DEG, aspect, 0.05, 100, fovDir);
  updateCamera();
}

function updateCamera() {
  const { yaw, pitch, dist, target } = orbit;
  const eye = [
    target[0] + dist * Math.sin(yaw) * Math.cos(pitch),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(yaw) * Math.cos(pitch),
  ];
  camera.lookAt(eye, target, [0, 1, 0]);
}

// Frames the whole bbox. `targetY` overrides the look-at height (chest height for the human
// view); the distance is then fitted to the farthest bbox corner so the feet still show.
function frameCamera(aabb, { targetY } = {}) {
  const min = aabb.min, max = aabb.max;
  const cy = targetY ?? (min[1] + max[1]) / 2;
  orbit.target = [(min[0] + max[0]) / 2, cy, (min[2] + max[2]) / 2];
  let radius = 0;
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    radius = Math.max(radius, Math.hypot(x - orbit.target[0], y - cy, z - orbit.target[2]));
  }
  // FOV_DEG is applied to the narrower axis, so the sphere always fits.
  orbit.dist = ((radius || 1) / Math.sin((FOV_DEG / 2) * Math.PI / 180)) * 1.05;
  orbit.yaw = 0;
  orbit.pitch = CHEST_PITCH;
  updateCamera();
}

function setupOrbit() {
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    orbit.yaw -= (e.clientX - lastX) * 0.006;
    orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + (e.clientY - lastY) * 0.006));
    lastX = e.clientX;
    lastY = e.clientY;
    updateCamera();
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.dist = Math.min(50, Math.max(0.3, orbit.dist * Math.exp(e.deltaY * 0.001)));
    updateCamera();
  }, { passive: false });
}

let fpsFrames = 0, fpsSince = performance.now();
function frame(now) {
  if (renderer.beginFrame(swapChain)) {
    renderer.renderView(view);
    renderer.endFrame();
  }
  engine.execute();
  fpsFrames++;
  if (now - fpsSince >= 500) {
    fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsSince))} fps`;
    fpsFrames = 0;
    fpsSince = now;
  }
  requestAnimationFrame(frame);
}

function clearAsset() {
  if (!currentAsset) return;
  scene.removeEntities(currentAsset.getEntities());
  loader.destroyAsset(currentAsset);
  currentAsset = null;
}

async function showModel(url, { frame = false, targetY } = {}) {
  const token = ++loadToken;
  setStatus(`Loading ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (token !== loadToken) return;

  const asset = loader.createAsset(bytes);
  await new Promise((done) => asset.loadResources(done, null, new URL(url, location.href).href));
  if (token !== loadToken) { loader.destroyAsset(asset); return; }

  clearAsset();
  scene.addEntities(asset.getEntities());
  asset.releaseSourceData();
  currentAsset = asset;
  if (frame) frameCamera(asset.getBoundingBox(), { targetY });
  setStatus(`Showing ${url}`);
}

// ---------------------------------------------------------------- views ----

async function showHumanView({ frame = false } = {}) {
  mode = 'human';
  aloneId = null;
  backBtn.hidden = true;
  renderList();
  const ids = [...worn.values()];
  let url = humanUrl;
  if (ids.length) {
    setStatus('Dressing…');
    url = (await api.dress(ids)).url;
  }
  await showModel(url, { frame, targetY: CHEST_Y });
}

async function showAloneView(garment) {
  mode = 'alone';
  aloneId = garment.id;
  backBtn.hidden = false;
  renderList();
  await showModel(garment.urls.glb, { frame: true });
}

function guard(fn) {
  return (...args) => fn(...args).catch((err) => setStatus(String(err.message || err), true));
}

const refreshHuman = guard(showHumanView);

function renderList() {
  listEl.replaceChildren(...garments.map((g) => {
    const li = document.createElement('li');
    const isWorn = worn.get(g.slot) === g.id;
    li.classList.toggle('worn', isWorn);

    const img = document.createElement('img');
    img.src = g.urls.cutout;
    img.alt = '';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.textContent = `${g.category} (${g.slot})`;
    const views = document.createElement('div');
    views.className = 'views';
    // v1 sidecars have no `views`; they were built from a single front image.
    views.textContent = `views: ${Array.isArray(g.views) && g.views.length ? g.views.join(', ') : 'front'}`;
    const honesty = document.createElement('div');
    honesty.className = 'honesty';
    honesty.textContent = HONESTY_LABEL;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const wearBtn = document.createElement('button');
    wearBtn.type = 'button';
    wearBtn.textContent = isWorn ? 'Take off' : 'Wear';
    wearBtn.onclick = () => {
      if (isWorn) worn.delete(g.slot); else worn.set(g.slot, g.id);
      refreshHuman();
    };
    const aloneBtn = document.createElement('button');
    aloneBtn.type = 'button';
    aloneBtn.textContent = 'View alone';
    aloneBtn.disabled = mode === 'alone' && aloneId === g.id;
    aloneBtn.onclick = guard(() => showAloneView(g));
    actions.append(wearBtn, aloneBtn);

    meta.append(title, views, honesty, actions);
    li.append(img, meta);
    return li;
  }));
}

$('build').onclick = guard(async () => {
  const files = { front: $('image').files[0], back: $('image_back').files[0], side: $('image_side').files[0] };
  if (!files.front) { setStatus('Choose a front image first.', true); return; }
  const category = $('category').value;
  const names = Object.values(files).filter(Boolean).map((f) => f.name).join(', ');
  setStatus(`Building ${category} from ${names}…`);
  $('build').disabled = true;
  try {
    const g = await api.build(files, category);
    garments.push(g);
    renderList();
    setStatus(`Built ${g.category} ${g.id}`);
  } finally {
    $('build').disabled = false;
  }
});

backBtn.onclick = () => refreshHuman({ frame: true });

// ---------------------------------------------------------------- boot -----

function normalize(v) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

Filament.init([IBL_URL, SKY_URL], guard(async () => {
  setupFilament();
  humanUrl = (await api.human()).url;
  await showHumanView({ frame: true });
  try {
    garments.push(...await api.garments());
    renderList();
  } catch (err) {
    console.warn('GET /api/garments failed', err);
  }
}));
