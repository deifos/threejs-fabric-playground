import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ── Renderer ─────────────────────────────────────────────────────────
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ── Scene ────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  28,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0, 0);
controls.minDistance = 4;
controls.maxDistance = 18;

// ── Lighting ─────────────────────────────────────────────────────────
// Most of the realism comes from the env map; the directional lights are
// kept low to avoid stagy highlights.
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 8, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 25;
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);

const rim = new THREE.DirectionalLight(0xc7d6ee, 0.4);
rim.position.set(-3, 4, -7);
scene.add(rim);

// ── Environment map (RoomEnvironment) ───────────────────────────────
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
pmrem.dispose();

// ── Ground (catches shadows only) ────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ opacity: 0.18 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.5;
ground.receiveShadow = true;
scene.add(ground);

// ── Helpers ──────────────────────────────────────────────────────────
function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ── iPhone dimensions ────────────────────────────────────────────────
const PHONE_W = 1.55;
const PHONE_H = 3.20;
const PHONE_D = 0.11;     // thin slab
const PHONE_R = 0.30;     // corner radius (silhouette)

// Moderate bevel — keep some side rail visible while rounding the edges
const BEVEL_T = 0.025;
const BEVEL_S = 0.025;
const EXTRUDE_D = PHONE_D - 2 * BEVEL_T;

const FRONT_W = PHONE_W - 2 * BEVEL_S;
const FRONT_H = PHONE_H - 2 * BEVEL_S;
const FRONT_R = PHONE_R - BEVEL_S;

// Bezel/screen are sized to MATCH the silhouette (not the smaller front cap),
// so they visually cover the entire front of the phone like a real iPhone.
const BEZEL_W = PHONE_W - 0.02;
const BEZEL_H = PHONE_H - 0.02;
const BEZEL_R = PHONE_R - 0.01;
const BEZEL_M = 0.025; // black border between the bezel edge and the screen
const SCR_W = BEZEL_W - BEZEL_M * 2;
const SCR_H = BEZEL_H - BEZEL_M * 2;

// ── Materials ────────────────────────────────────────────────────────
const phoneColors = {
  blue:  { body: 0xb8d4e6, rail: 0xc6dceb },
  black: { body: 0x2a2d33, rail: 0x42464d },
  white: { body: 0xeef0f2, rail: 0xdadcde },
  pink:  { body: 0xf3d6d4, rail: 0xefcdcb },
};

// Anodized aluminum body — clearcoat gives the slight glossy finish.
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xb8d4e6,
  metalness: 0.55,
  roughness: 0.42,
  clearcoat: 0.45,
  clearcoatRoughness: 0.18,
});

// More polished side rail
const railMat = new THREE.MeshPhysicalMaterial({
  color: 0xc6dceb,
  metalness: 0.85,
  roughness: 0.18,
  clearcoat: 0.6,
  clearcoatRoughness: 0.10,
});

const screenBezelMat = new THREE.MeshBasicMaterial({ color: 0x06080c });

// Dimmed slightly so the screen image doesn't blow out next to light bodies
const screenMat = new THREE.MeshBasicMaterial({
  color: 0xc8c8c8,
  toneMapped: false,
});

const lensGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0x14171c,
  metalness: 0.3,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
});

const lensRingMat = new THREE.MeshPhysicalMaterial({
  color: 0x6c7480,
  metalness: 0.95,
  roughness: 0.15,
  clearcoat: 0.5,
  clearcoatRoughness: 0.1,
});

const flashMat = new THREE.MeshStandardMaterial({
  color: 0xc8d4e2,
  metalness: 0.3,
  roughness: 0.4,
});

const cameraPlateauMat = new THREE.MeshPhysicalMaterial({
  color: 0xc8dceb,
  metalness: 0.55,
  roughness: 0.4,
  clearcoat: 0.45,
  clearcoatRoughness: 0.18,
});

const buttonMat = new THREE.MeshPhysicalMaterial({
  color: 0xc6dceb,
  metalness: 0.85,
  roughness: 0.18,
  clearcoat: 0.6,
  clearcoatRoughness: 0.1,
});

const portMat = new THREE.MeshBasicMaterial({ color: 0x06080c });

// ── Phone group ──────────────────────────────────────────────────────
const phone = new THREE.Group();
scene.add(phone);

// ── Body (rounded rectangle profile, extruded with big bevel) ───────
// The big bevel rounds the entire perimeter of the phone, wrapping the
// edges from front to back like a real iPhone.
const bodyShape = rrShape(PHONE_W, PHONE_H, PHONE_R);
const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
  depth: EXTRUDE_D,
  bevelEnabled: true,
  bevelThickness: BEVEL_T,
  bevelSize: BEVEL_S,
  bevelSegments: 12,
  curveSegments: 40,
});
// ExtrudeGeometry vertices run z = -BEVEL_T to z = EXTRUDE_D + BEVEL_T.
// Translate so the center is at z=0 (front at +PHONE_D/2, back at -PHONE_D/2).
bodyGeo.translate(0, 0, -EXTRUDE_D / 2);
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.castShadow = true;
body.receiveShadow = true;
phone.add(body);

// ── Front bezel (covers the silhouette, not just the small front cap) ──
const frontBezelGeo = new THREE.ShapeGeometry(rrShape(BEZEL_W, BEZEL_H, BEZEL_R));
const frontBezel = new THREE.Mesh(frontBezelGeo, screenBezelMat);
const FRONT_Z = PHONE_D / 2 + 0.002;
frontBezel.position.z = FRONT_Z;
phone.add(frontBezel);

// ── Screen (image) — rounded shape with corrected UVs so the texture
// is clipped to the screen shape instead of overflowing the bezel.
const SCR_R = BEZEL_R - BEZEL_M;
const scrShape = rrShape(SCR_W, SCR_H, SCR_R);
const scrGeo = new THREE.ShapeGeometry(scrShape, 24);
{
  // ShapeGeometry uses raw vertex XY for UVs by default. Remap to 0..1.
  const pos = scrGeo.attributes.position;
  const uv = scrGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x + SCR_W / 2) / SCR_W, (y + SCR_H / 2) / SCR_H);
  }
  uv.needsUpdate = true;
}
const screen = new THREE.Mesh(scrGeo, screenMat);
screen.position.z = FRONT_Z + 0.001;
phone.add(screen);

// Try to load the wallpaper
new THREE.TextureLoader().load(
  "/iphone-screen.png",
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    screenMat.map = tex;
    screenMat.needsUpdate = true;
  },
  undefined,
  (err) => console.error("[iphone] failed to load /iphone-screen.png", err)
);

// ── Dynamic Island (small dark pill near the top of the screen) ─────
const islandW = 0.42;
const islandH = 0.10;
const islandGeo = new THREE.ShapeGeometry(rrShape(islandW, islandH, islandH / 2));
const island = new THREE.Mesh(
  islandGeo,
  new THREE.MeshBasicMaterial({ color: 0x05070b })
);
island.position.set(0, BEZEL_H / 2 - 0.14, FRONT_Z + 0.002);
phone.add(island);

// The flat back face cap is at -PHONE_D/2 after the bevel.
const BACK_Z = -PHONE_D / 2 - 0.001;

// ── Apple logo (center back) ────────────────────────────────────────
const logoCanvas = document.createElement("canvas");
logoCanvas.width = 256;
logoCanvas.height = 256;
const lctx = logoCanvas.getContext("2d");
lctx.clearRect(0, 0, 256, 256);
lctx.font = "180px -apple-system, system-ui";
lctx.fillStyle = "#ffffff";
lctx.textAlign = "center";
lctx.textBaseline = "middle";
lctx.fillText("\uF8FF", 128, 138);
const logoTex = new THREE.CanvasTexture(logoCanvas);
logoTex.colorSpace = THREE.SRGBColorSpace;
const appleLogo = new THREE.Mesh(
  new THREE.PlaneGeometry(0.42, 0.42),
  new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false })
);
appleLogo.position.set(0, 0, BACK_Z - 0.001);
appleLogo.rotation.y = Math.PI;
phone.add(appleLogo);

// ── Camera plateau (back, top-left) — wide pill shape ──────────────
const PLATEAU_W = 0.85;
const PLATEAU_H = 0.42;
const PLATEAU_D = 0.05;
const PLATEAU_R = 0.21; // = PLATEAU_H / 2 (full pill)

const plateauShape = rrShape(PLATEAU_W, PLATEAU_H, PLATEAU_R);
const plateauGeo = new THREE.ExtrudeGeometry(plateauShape, {
  depth: PLATEAU_D - 0.012,
  bevelEnabled: true,
  bevelThickness: 0.006,
  bevelSize: 0.006,
  bevelSegments: 6,
  curveSegments: 32,
});
// Translate so the plateau geometry extends from z=-PLATEAU_D to z=0
// (outer face away from the phone, inner face touching the back).
plateauGeo.translate(0, 0, -PLATEAU_D + 0.006);

const PLATEAU_X = -FRONT_W / 2 + PLATEAU_W / 2 + 0.10;
const PLATEAU_Y = FRONT_H / 2 - PLATEAU_H / 2 - 0.12;
// Outer face of the plateau (the face the lenses sit on)
const PLATEAU_BACK_Z = BACK_Z - PLATEAU_D - 0.002;

const plateau = new THREE.Mesh(plateauGeo, cameraPlateauMat);
plateau.position.set(PLATEAU_X, PLATEAU_Y, BACK_Z);
plateau.castShadow = true;
phone.add(plateau);

// Lens center is offset to the LEFT inside the pill, with the flash to the right.
const LENS_X = PLATEAU_X - 0.21;
const FLASH_X = PLATEAU_X + 0.21;

// Big lens — outer metallic ring + glass + inner highlight
const bigLensRingGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 36);
const bigLensRing = new THREE.Mesh(bigLensRingGeo, lensRingMat);
bigLensRing.rotation.x = Math.PI / 2;
bigLensRing.position.set(LENS_X, PLATEAU_Y, PLATEAU_BACK_Z - 0.018);
phone.add(bigLensRing);

const bigLensGlassGeo = new THREE.CircleGeometry(0.10, 32);
const bigLensGlass = new THREE.Mesh(bigLensGlassGeo, lensGlassMat);
bigLensGlass.rotation.y = Math.PI;
bigLensGlass.position.set(LENS_X, PLATEAU_Y, PLATEAU_BACK_Z - 0.041);
phone.add(bigLensGlass);

// Inner lens highlight (smaller circle inside)
const innerLensGeo = new THREE.CircleGeometry(0.05, 24);
const innerLens = new THREE.Mesh(
  innerLensGeo,
  new THREE.MeshBasicMaterial({ color: 0x202730 })
);
innerLens.rotation.y = Math.PI;
innerLens.position.set(LENS_X, PLATEAU_Y, PLATEAU_BACK_Z - 0.043);
phone.add(innerLens);

// Flash (small dot to the right of the lens)
const flashGeo = new THREE.CircleGeometry(0.038, 20);
const flash = new THREE.Mesh(flashGeo, flashMat);
flash.rotation.y = Math.PI;
flash.position.set(FLASH_X, PLATEAU_Y + 0.05, PLATEAU_BACK_Z - 0.001);
phone.add(flash);

// Microphone hole (small dot below flash)
const micGeo = new THREE.CircleGeometry(0.014, 16);
const mic = new THREE.Mesh(micGeo, new THREE.MeshBasicMaterial({ color: 0x06080c }));
mic.rotation.y = Math.PI;
mic.position.set(FLASH_X, PLATEAU_Y - 0.06, PLATEAU_BACK_Z - 0.001);
phone.add(mic);

// ── Side buttons (vertical pills clearly poking out from the rail) ──
function makeButton(length) {
  // Small extruded rounded rect that pokes out from the side rail.
  const buttonZ = 0.045; // front/back thickness
  const buttonW = 0.04;  // how far it pokes out from the side
  const shape = rrShape(length, buttonZ, buttonZ * 0.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: buttonW,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 12,
  });
  // Shape was in XY plane, extruded along +Z. Reorient so the long axis is Y
  // and the extrusion direction becomes ±X.
  geo.rotateZ(Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  // Center the extrusion symmetrically around X=0 so position.x sits on the
  // silhouette (half inside the body, half outside).
  geo.translate(-buttonW / 2, 0, 0);
  const m = new THREE.Mesh(geo, buttonMat);
  m.castShadow = true;
  return m;
}

// Push the buttons fully outside the silhouette so they're clearly visible
// from the front view. With buttonW/2 = 0.02 the inner edge just kisses the
// side wall (rather than being half-buried inside the body).
const BUTTON_OFFSET = 0.017;

// LEFT side: action button (top), volume up, volume down
const leftEdge = -PHONE_W / 2 - BUTTON_OFFSET;

const actionBtn = makeButton(0.12);
actionBtn.position.set(leftEdge, PHONE_H / 2 - 0.62, 0);
phone.add(actionBtn);

const volUp = makeButton(0.22);
volUp.position.set(leftEdge, PHONE_H / 2 - 0.95, 0);
phone.add(volUp);

const volDown = makeButton(0.22);
volDown.position.set(leftEdge, PHONE_H / 2 - 1.25, 0);
phone.add(volDown);

// RIGHT side: power button
const rightEdge = PHONE_W / 2 + BUTTON_OFFSET;
const powerBtn = makeButton(0.32);
powerBtn.position.set(rightEdge, PHONE_H / 2 - 0.85, 0);
phone.add(powerBtn);

// ── USB-C port at the bottom ─────────────────────────────────────────
const portGeo = new THREE.BoxGeometry(0.18, 0.028, 0.04);
const port = new THREE.Mesh(portGeo, portMat);
port.position.set(0, -PHONE_H / 2 - 0.001, 0);
phone.add(port);

// Speaker grilles (left and right of the USB-C port)
const speakerHoles = 6;
for (let i = 0; i < speakerHoles; i++) {
  const holeGeo = new THREE.CircleGeometry(0.016, 16);
  const hole = new THREE.Mesh(holeGeo, portMat);
  hole.rotation.x = Math.PI / 2;
  const sideSign = i < speakerHoles / 2 ? -1 : 1;
  const indexInGroup = i % (speakerHoles / 2);
  hole.position.set(
    sideSign * (0.22 + indexInGroup * 0.05),
    -PHONE_H / 2 - 0.001,
    0
  );
  phone.add(hole);
}

// ── Color picker ─────────────────────────────────────────────────────
function setPhoneColor(name) {
  const palette = phoneColors[name];
  if (!palette) return;
  bodyMat.color.setHex(palette.body);
  railMat.color.setHex(palette.rail);
  cameraPlateauMat.color.setHex(palette.body);
  buttonMat.color.setHex(palette.rail);
}

document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const name = swatch.dataset.color;
    setPhoneColor(name);
    document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
  });
});

const defaultSwatch = document.querySelector('.swatch[data-color="blue"]');
if (defaultSwatch) defaultSwatch.classList.add("active");

// ── API ──────────────────────────────────────────────────────────────
window.mockup = {
  phone,
  setColor: setPhoneColor,
};

// ── Post-processing (MSAA) ──────────────────────────────────────────
const composerTarget = new THREE.WebGLRenderTarget(
  window.innerWidth, window.innerHeight,
  {
    type: THREE.HalfFloatType,
    samples: 4,
  }
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// ── Loop ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render();
}
animate();

// ── Resize ───────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
