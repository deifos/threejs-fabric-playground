import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Canvas as FabricCanvas, Rect } from "fabric";

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
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.0, 6.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.85, 0);
controls.minDistance = 3;
controls.maxDistance = 18;

// ── Lighting ─────────────────────────────────────────────────────────
// A soft ambient base + a key directional light that casts the contact shadow.
// The bulk of the realism now comes from the env map, not from individual
// directional lights (which tend to look "stagy").
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 25;
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0004;
key.shadow.radius = 6; // softer penumbra
scene.add(key);

// Wraparound rim from behind for a sculpted edge highlight
const rim = new THREE.DirectionalLight(0xc7d6ee, 0.4);
rim.position.set(-3, 4, -7);
scene.add(rim);

// ── Environment map (RoomEnvironment) ───────────────────────────────
// RoomEnvironment is the same procedural indoor scene three.js uses in its
// MaterialX/PBR examples. It gives us proper PBR lighting without an HDRI.
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
pmrem.dispose();

// ── Ground ───────────────────────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.18 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// ── Fabric.js ────────────────────────────────────────────────────────
const fabricEl = document.getElementById("fabric-canvas");
const fabricCanvas = new FabricCanvas(fabricEl, {
  width: 1600,
  height: 1000,
  selection: true,
  preserveObjectStacking: true,
  backgroundColor: "#0a1838",
  enableRetinaScaling: false,
});

function seedFabricScene() {
  const FW = fabricCanvas.width;
  const FH = fabricCanvas.height;

  // Dark navy background
  const background = new Rect({
    left: 0, top: 0, width: FW, height: FH,
    fill: "#0a1838", selectable: false, evented: false,
  });
  fabricCanvas.add(background);

  // Vertical pills with solid colors (Sequoia-inspired)
  const pillData = [
    { color: "#3b82f6", h: 0.78 },
    { color: "#8b5cf6", h: 0.62 },
    { color: "#fb923c", h: 0.85 },
    { color: "#a855f7", h: 0.55 },
    { color: "#3b82f6", h: 0.82 },
    { color: "#f59e0b", h: 0.68 },
    { color: "#6366f1", h: 0.74 },
  ];

  const margin = FW * 0.06;
  const usable = FW - margin * 2;
  const slot = usable / pillData.length;
  const pillW = slot * 0.58;

  pillData.forEach((p, i) => {
    const pillH = FH * p.h;
    const left = margin + slot * i + (slot - pillW) / 2;
    const top = (FH - pillH) / 2;

    const pill = new Rect({
      left, top,
      width: pillW, height: pillH,
      rx: pillW / 2, ry: pillW / 2,
      fill: p.color,
      selectable: false, evented: false,
    });
    fabricCanvas.add(pill);

    // Glossy highlight strip
    const gloss = new Rect({
      left: left + pillW * 0.16,
      top: top + pillH * 0.06,
      width: pillW * 0.22,
      height: pillH * 0.88,
      rx: pillW * 0.11,
      ry: pillW * 0.11,
      fill: "rgba(255,255,255,0.18)",
      selectable: false, evented: false,
    });
    fabricCanvas.add(gloss);
  });

  fabricCanvas.renderAll();
}
seedFabricScene();

// ── Fabric → Texture ─────────────────────────────────────────────────
const fabricTexture = new THREE.CanvasTexture(fabricCanvas.getElement());
fabricTexture.colorSpace = THREE.SRGBColorSpace;
fabricTexture.minFilter = THREE.LinearFilter;
fabricTexture.magFilter = THREE.LinearFilter;
fabricTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
fabricTexture.needsUpdate = true;

fabricCanvas.on("after:render", () => {
  fabricTexture.needsUpdate = true;
});

// Force one more render so the texture picks up the seeded scene
requestAnimationFrame(() => {
  fabricCanvas.renderAll();
  fabricTexture.needsUpdate = true;
});

// ── Helper: Rounded Rect Shape ───────────────────────────────────────
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

// ── Dimensions (in scene units) ──────────────────────────────────────
const W = 3.58;           // laptop width
const BASE_W = W;
const BASE_D = 2.32;       // depth front-to-back
// Hinge sits 0.04 forward of the back edge, so the lid panel must equal
// (BASE_D - 0.04) for the closed lid front edge to land flush with the base.
const LID_H = BASE_D - 0.04; // = 2.28
const LID_D = 0.038;      // lid thickness
const LID_R = 0.10;       // corner radius

const BEZEL_T = 0.055;    // top bezel
const BEZEL_S = 0.045;    // side bezel
const BEZEL_B = 0.10;     // chin (slightly thicker)

const SCR_W = W - BEZEL_S * 2;
const SCR_H = LID_H - BEZEL_T - BEZEL_B;
const BASE_THICKNESS = 0.10; // total height (slimmer, like the reference)
const BASE_BEVEL = 0.010;
const BASE_DEPTH = BASE_THICKNESS - 2 * BASE_BEVEL; // extruded body depth
const BASE_R = 0.12;       // top-down corner radius

const HINGE_R = 0.042;
const OPEN_ANGLE = 1.85; // ~106° (lid tilted back slightly)

// ── Materials ────────────────────────────────────────────────────────
// MeshPhysicalMaterial gives us clearcoat — a thin glossy layer over the
// anodized aluminum that catches highlights the way real MacBooks do.
const aluminumColor = new THREE.Color(0x676e89);
const aluminum = new THREE.MeshPhysicalMaterial({
  color: aluminumColor,
  metalness: 0.55,
  roughness: 0.42,
  clearcoat: 0.45,
  clearcoatRoughness: 0.18,
  reflectivity: 0.4,
  envMapIntensity: 1.0,
});

const aluminumDark = new THREE.MeshPhysicalMaterial({
  color: 0x565d75,
  metalness: 0.55,
  roughness: 0.45,
  clearcoat: 0.45,
  clearcoatRoughness: 0.20,
  reflectivity: 0.4,
  envMapIntensity: 1.0,
});

const bezelMat = new THREE.MeshStandardMaterial({
  color: 0x111519,
  metalness: 0.15,
  roughness: 0.55,
});

// Screen material — dimmed slightly so the bright pixels of the screenshot
// don't blow out next to light body colors.
const screenMat = new THREE.MeshBasicMaterial({
  color: 0xc8c8c8,
  side: THREE.FrontSide,
  toneMapped: false,
});

// Load the screenshot and apply it as the screen texture
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  "/screen.png",
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    screenMat.map = tex;
    screenMat.needsUpdate = true;
    console.log("[mockup] screen texture loaded", tex.image.width + "x" + tex.image.height);
  },
  undefined,
  (err) => {
    console.error("[mockup] failed to load /screen.png", err);
  }
);

const keyMat = new THREE.MeshStandardMaterial({
  color: 0x1a1f26,
  metalness: 0.2,
  roughness: 0.7,
});

const trackpadMat = new THREE.MeshStandardMaterial({
  color: 0x676e89, // overridden by setLaptopColor
  metalness: 0.35,
  roughness: 0.4,
});

const hingeMat = new THREE.MeshStandardMaterial({
  color: 0x3a4250,
  metalness: 0.92,
  roughness: 0.12,
});

const rubberMat = new THREE.MeshStandardMaterial({
  color: 0x0e1015,
  metalness: 0.0,
  roughness: 0.95,
});

// ── MacBook Group ────────────────────────────────────────────────────
const laptop = new THREE.Group();

// ═══════════════════════════════════════════════════════════════════════
//  LID
// ═══════════════════════════════════════════════════════════════════════
const lidPivot = new THREE.Group(); // rotates around hinge axis

// Lid shell (extruded rounded rect)
const lidShape = rrShape(W, LID_H, LID_R);
const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
  depth: LID_D,
  bevelEnabled: true,
  bevelThickness: 0.006,
  bevelSize: 0.006,
  bevelSegments: 3,
});
const lidMesh = new THREE.Mesh(lidGeo, aluminum);
lidMesh.castShadow = true;
lidPivot.add(lidMesh);

// IMPORTANT: the lid is extruded with a 0.006 bevel, so the actual lid front
// face is at z = LID_D + 0.006. We need to position the bezel and screen
// well past that to avoid being hidden by the bevel.
const LID_FRONT_Z = LID_D + 0.01;

// Bezel: a solid dark rounded-rect plate sitting just in front of the lid shell
const bezelGeo = new THREE.ShapeGeometry(
  rrShape(W - 0.04, LID_H - 0.04, LID_R - 0.01)
);
const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
bezelMesh.position.z = LID_FRONT_Z;
lidPivot.add(bezelMesh);

// Screen sits in front of the bezel.
const scrGeo = new THREE.PlaneGeometry(SCR_W, SCR_H);
const scrMesh = new THREE.Mesh(scrGeo, screenMat);
scrMesh.position.y = (BEZEL_T - BEZEL_B) / 2;
scrMesh.position.z = LID_FRONT_Z + 0.003;
lidPivot.add(scrMesh);

// Subtle gloss overlay in front of the screen
const glossMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(SCR_W, SCR_H),
  new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.04, depthWrite: false,
  })
);
glossMesh.position.y = (BEZEL_T - BEZEL_B) / 2;
glossMesh.position.z = LID_FRONT_Z + 0.005;
lidPivot.add(glossMesh);

// Camera notch (small dark circle at top center)
const notchGeo = new THREE.CircleGeometry(0.018, 16);
const notchMesh = new THREE.Mesh(notchGeo, new THREE.MeshBasicMaterial({ color: 0x0a0d12 }));
notchMesh.position.set(0, LID_H / 2 - BEZEL_T / 2, LID_FRONT_Z + 0.001);
lidPivot.add(notchMesh);

// Lid back panel (slightly different shade)
const lidBackGeo = new THREE.ShapeGeometry(rrShape(W - 0.06, LID_H - 0.06, LID_R - 0.01));
const lidBackMesh = new THREE.Mesh(lidBackGeo, aluminumDark);
lidBackMesh.position.z = -0.001;
lidBackMesh.rotation.y = Math.PI;
lidPivot.add(lidBackMesh);

// Apple logo on the lid back
const appleCanvas = document.createElement("canvas");
appleCanvas.width = 256;
appleCanvas.height = 256;
const appleCtx = appleCanvas.getContext("2d");
appleCtx.clearRect(0, 0, 256, 256);
appleCtx.font = "180px -apple-system, system-ui";
appleCtx.fillStyle = "#5a6577";
appleCtx.textAlign = "center";
appleCtx.textBaseline = "middle";
appleCtx.fillText("\uF8FF", 128, 138); // Apple logo glyph (works on macOS); falls back to a box on others
const appleTex = new THREE.CanvasTexture(appleCanvas);
appleTex.colorSpace = THREE.SRGBColorSpace;
const appleLogo = new THREE.Mesh(
  new THREE.PlaneGeometry(0.5, 0.5),
  new THREE.MeshBasicMaterial({ map: appleTex, transparent: true, depthWrite: false })
);
appleLogo.position.set(0, 0, -0.0015);
appleLogo.rotation.y = Math.PI;
lidPivot.add(appleLogo);

// "Macbook Air" text on chin
const chinCanvas = document.createElement("canvas");
chinCanvas.width = 512;
chinCanvas.height = 64;
const chinCtx = chinCanvas.getContext("2d");
chinCtx.clearRect(0, 0, 512, 64);
chinCtx.font = "300 24px system-ui, -apple-system, sans-serif";
chinCtx.fillStyle = "#4a5568";
chinCtx.textAlign = "center";
chinCtx.fillText("MacBook Air", 256, 40);
const chinTex = new THREE.CanvasTexture(chinCanvas);
chinTex.colorSpace = THREE.SRGBColorSpace;
const chinLabel = new THREE.Mesh(
  new THREE.PlaneGeometry(0.7, 0.09),
  new THREE.MeshBasicMaterial({ map: chinTex, transparent: true, depthWrite: false })
);
chinLabel.position.set(0, -LID_H / 2 + BEZEL_B * 0.4, LID_FRONT_Z + 0.002);
lidPivot.add(chinLabel);

// Position lid so bottom edge is at y=0 (hinge point)
lidPivot.children.forEach((c) => { c.position.y += LID_H / 2; });

// Open the lid (0 = closed flat over keyboard, PI/2 = perpendicular, PI = flat back)
lidPivot.rotation.x = Math.PI / 2 - OPEN_ANGLE;
lidPivot.position.set(0, BASE_THICKNESS + HINGE_R * 0.5, -BASE_D / 2 + 0.04);

laptop.add(lidPivot);

// ═══════════════════════════════════════════════════════════════════════
//  BASE (uniform-thickness rounded slab — modern MacBook Air style)
// ═══════════════════════════════════════════════════════════════════════
const baseShape = rrShape(BASE_W, BASE_D, BASE_R);
const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
  depth: BASE_DEPTH,
  bevelEnabled: true,
  bevelThickness: BASE_BEVEL,
  bevelSize: BASE_BEVEL,
  bevelSegments: 5,
  curveSegments: 24,
});
// rrShape lives in XY plane → rotate so width=X, height=Y, depth=Z.
// After rotateX(-π/2), original z range [-bevel, depth+bevel] becomes Y range [-bevel, depth+bevel].
baseGeo.rotateX(-Math.PI / 2);
// Lift so the very bottom of the bevel sits at Y=0.
baseGeo.translate(0, BASE_BEVEL, 0);
// Now Y range is [0, BASE_DEPTH + 2*BASE_BEVEL] = [0, BASE_THICKNESS]

const baseMesh = new THREE.Mesh(baseGeo, aluminum);
baseMesh.castShadow = true;
baseMesh.receiveShadow = true;
laptop.add(baseMesh);

// ── Side ports (small dark boxes that poke out from the side) ───────
const portMat = new THREE.MeshStandardMaterial({
  color: 0x0a0d14,
  metalness: 0.3,
  roughness: 0.85,
});

// The slab's actual side faces are at ±(BASE_W/2 + BASE_BEVEL)
const slabHalfW = BASE_W / 2 + BASE_BEVEL;
const portY = BASE_THICKNESS * 0.5; // vertical centerline of the slab

// USB-C ports on the LEFT side — two small slots near the back
const usbW = 0.13;     // width along Z (front-back direction)
const usbH = 0.028;    // height along Y
const usbDepth = 0.03; // how far it pokes out along X
const usbZSpacing = 0.20;
[-usbZSpacing / 2, usbZSpacing / 2].forEach((zOff) => {
  const port = new THREE.Mesh(
    new THREE.BoxGeometry(usbDepth, usbH, usbW),
    portMat
  );
  port.position.set(
    -slabHalfW + usbDepth / 2 - 0.005, // outer face just outside slab side
    portY,
    zOff - BASE_D * 0.25
  );
  laptop.add(port);
});

// Headphone jack on the RIGHT side (toward the back)
const jackBox = new THREE.Mesh(
  new THREE.CylinderGeometry(0.022, 0.022, 0.03, 18),
  portMat
);
jackBox.rotation.z = Math.PI / 2;
jackBox.position.set(
  slabHalfW - 0.015 + 0.005,
  portY,
  -BASE_D * 0.32
);
laptop.add(jackBox);

// Speaker grille on the RIGHT side — close to the front corner
const grilleW = BASE_W * 0.18; // along Z (front-back)
const grilleH = 0.014;
const grilleDepth = 0.025;
const grilleMesh = new THREE.Mesh(
  new THREE.BoxGeometry(grilleDepth, grilleH, grilleW),
  portMat
);
grilleMesh.position.set(
  slabHalfW - grilleDepth / 2 + 0.005,
  BASE_THICKNESS * 0.62,
  BASE_D * 0.30
);
laptop.add(grilleMesh);

// Mirror grille on the LEFT side
const grilleMeshL = grilleMesh.clone();
grilleMeshL.position.x = -grilleMesh.position.x;
laptop.add(grilleMeshL);

// ── Curved "lift to open" notch on the top-front edge ───────────────
// Half-ellipse shape giving a wide, shallow scallop look.
const liftShape = new THREE.Shape();
const liftW = 0.18;  // half-width of the scallop
const liftH = 0.035; // depth (how far down the curve goes)
liftShape.moveTo(-liftW, 0);
liftShape.absellipse(0, 0, liftW, liftH, Math.PI, 2 * Math.PI, false, 0);
liftShape.lineTo(-liftW, 0);

// Use the same material as the body so it follows the swatch color
const liftGeo = new THREE.ShapeGeometry(liftShape);
const liftMesh = new THREE.Mesh(liftGeo, aluminum);
// Place on the front face, scallop opening upward at the top of the slab
liftMesh.position.set(
  0,
  BASE_THICKNESS - 0.001,
  BASE_D / 2 + BASE_BEVEL + 0.001
);
laptop.add(liftMesh);

// ── Top deck: keyboard + trackpad ────────────────────────────────────
// Sits flat on top of the uniform-thickness slab.
const topDeck = new THREE.Group();

// Keyboard plate (anodized to match the body)
const kbW = BASE_W * 0.85;
const kbD = BASE_D * 0.46;
const kbCenterZ = -BASE_D * 0.16; // forward enough to leave a margin from the hinge

const plateMat = new THREE.MeshStandardMaterial({
  color: 0x676e89, // overridden by setLaptopColor
  metalness: 0.3,
  roughness: 0.55,
});
const plateGeo = new THREE.ShapeGeometry(rrShape(kbW, kbD, 0.05));
plateGeo.rotateX(-Math.PI / 2);
const plateMesh = new THREE.Mesh(plateGeo, plateMat);
plateMesh.position.set(0, 0.002, kbCenterZ);
topDeck.add(plateMesh);

// ── Realistic key layout with labels ────────────────────────────────
// Each row: { h: heightUnits, keys: [{w: widthUnits, l: label}...] }
const k = (w, l) => ({ w, l });
const g = (w) => ({ w, gap: true });
const layout = [
  { h: 0.85, keys: [
    k(1,"esc"), k(1,"F1"), k(1,"F2"), k(1,"F3"), k(1,"F4"), k(1,"F5"), k(1,"F6"),
    k(1,"F7"), k(1,"F8"), k(1,"F9"), k(1,"F10"), k(1,"F11"), k(1,"F12"), k(1,"")
  ]},
  { h: 1.0, keys: [
    k(1,"`"), k(1,"1"), k(1,"2"), k(1,"3"), k(1,"4"), k(1,"5"), k(1,"6"),
    k(1,"7"), k(1,"8"), k(1,"9"), k(1,"0"), k(1,"-"), k(1,"="), k(1,"⌫")
  ]},
  { h: 1.0, keys: [
    k(1.5,"⇥"), k(1,"Q"), k(1,"W"), k(1,"E"), k(1,"R"), k(1,"T"), k(1,"Y"),
    k(1,"U"), k(1,"I"), k(1,"O"), k(1,"P"), k(1,"["), k(1,"]"), k(1.0,"\\")
  ]},
  { h: 1.0, keys: [
    k(1.75,"⇪"), k(1,"A"), k(1,"S"), k(1,"D"), k(1,"F"), k(1,"G"), k(1,"H"),
    k(1,"J"), k(1,"K"), k(1,"L"), k(1,";"), k(1,"'"), k(1.75,"return")
  ]},
  { h: 1.0, keys: [
    k(2.25,"⇧"), k(1,"Z"), k(1,"X"), k(1,"C"), k(1,"V"), k(1,"B"),
    k(1,"N"), k(1,"M"), k(1,","), k(1,"."), k(1,"/"), k(2.25,"⇧")
  ]},
  { h: 1.0, keys: [
    k(1,"fn"), k(1,"⌃"), k(1,"⌥"), k(1.25,"⌘"), k(5,""), k(1.25,"⌘"), k(1,"⌥"),
    k(1,"←"), { w: 1, l: "↑↓", stacked: true }, k(1,"→")
  ]},
];

const keyboardLayout = [
  { h: 0.6, keys: [
    k(1, "esc"), k(1, "F1"), k(1, "F2"), k(1, "F3"), k(1, "F4"), k(1, "F5"), k(1, "F6"),
    k(1, "F7"), k(1, "F8"), k(1, "F9"), k(1, "F10"), k(1, "F11"), k(1, "F12"), k(1, "")
  ]},
  { h: 1.0, keys: [
    k(1, "`"), k(1, "1"), k(1, "2"), k(1, "3"), k(1, "4"), k(1, "5"), k(1, "6"),
    k(1, "7"), k(1, "8"), k(1, "9"), k(1, "0"), k(1, "-"), k(1, "="), k(1, "\u232b")
  ]},
  { h: 1.0, keys: [
    k(1.5, "\u21e5"), k(1, "Q"), k(1, "W"), k(1, "E"), k(1, "R"), k(1, "T"), k(1, "Y"),
    k(1, "U"), k(1, "I"), k(1, "O"), k(1, "P"), k(1, "["), k(1, "]"), k(1.0, "\\")
  ]},
  { h: 1.0, keys: [
    k(1.75, "\u21ea"), k(1, "A"), k(1, "S"), k(1, "D"), k(1, "F"), k(1, "G"), k(1, "H"),
    k(1, "J"), k(1, "K"), k(1, "L"), k(1, ";"), k(1, "'"), k(1.75, "return")
  ]},
  { h: 1.0, keys: [
    k(2.25, "\u21e7"), k(1, "Z"), k(1, "X"), k(1, "C"), k(1, "V"), k(1, "B"),
    k(1, "N"), k(1, "M"), k(1, ","), k(1, "."), k(1, "/"), k(2.25, "\u21e7")
  ]},
  { h: 1.0, keys: [
    k(1, "fn"), k(1, "\u2303"), k(1, "\u2325"), k(1.25, "\u2318"), k(4.75, ""), k(1.25, "\u2318"), k(1, "\u2325"),
    g(0.7), k(0.9, "\u2190"), { w: 0.9, l: "\u2191\u2193", stacked: true }, k(0.9, "\u2192")
  ]},
];

// ── Label texture cache ──────────────────────────────────────────────
let labelTextColor = "#3a4050"; // updated when body color changes
const labelCache = new Map();

function getLabelTexture(text, fontPx = 64) {
  const cacheKey = `${text}|${fontPx}`;
  if (labelCache.has(cacheKey)) return labelCache.get(cacheKey);

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.font = `500 ${fontPx}px -apple-system, system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = labelTextColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  labelCache.set(cacheKey, tex);
  return tex;
}

// Anodized key cap colour: starts as a slightly lighter shade of the body
const keyCapMat = new THREE.MeshStandardMaterial({
  color: 0x7a8197,
  metalness: 0.25,
  roughness: 0.5,
});

// Track all label meshes so we can refresh their textures when the body color changes
const labelMeshes = [];

const innerKbW = kbW - 0.06;
const innerKbD = kbD - 0.06;
const rowGap = 0.018;
const colGap = 0.018;
const totalRowH = keyboardLayout.reduce((s, r) => s + r.h, 0);
const verticalGapTotal = (keyboardLayout.length - 1) * rowGap;
const unitH = (innerKbD - verticalGapTotal) / totalRowH;
const keyHeight = 0.018; // 3D pop-out height

const keyboardGroup = new THREE.Group();

// Lay rows from back (function row) to front (bottom row)
// In local space: -Z = back of laptop (top of keyboard); +Z = front (space bar)
let cursorZ = -innerKbD / 2;
keyboardLayout.forEach((row, rowIdx) => {
  const rowH = row.h * unitH;
  const rowUnits = row.keys.reduce((s, key) => s + key.w, 0);
  const horizGapTotal = (row.keys.length - 1) * colGap;
  const unitW = (innerKbW - horizGapTotal) / rowUnits;
  const isFunctionRow = rowIdx === 0;

  let cursorX = -innerKbW / 2;
  row.keys.forEach((entry) => {
    const widthUnits = entry.w;
    const label = entry.l;
    const stacked = entry.stacked === true;
    const gap = entry.gap === true;
    const kw = widthUnits * unitW;
    const kh = rowH;

    if (gap) {
      cursorX += kw + colGap;
      return;
    }

    if (stacked) {
      // Two half-height keys (up over down) in the same column slot
      const halfH = (kh - 0.004) / 2;
      const radius = Math.min(0.012, halfH * 0.32);
      const upChar = label[0] || "↑";
      const downChar = label[1] || "↓";
      const cx = cursorX + kw / 2;

      [
        { ch: upChar, zOff: -halfH / 2 - 0.002 },
        { ch: downChar, zOff: halfH / 2 + 0.002 },
      ].forEach(({ ch, zOff }) => {
        const keyGeo = new RoundedBoxGeometry(kw, keyHeight, halfH, 2, radius);
        const keyMesh = new THREE.Mesh(keyGeo, keyCapMat);
        const cz = cursorZ + kh / 2 + zOff;
        keyMesh.position.set(cx, keyHeight / 2 + 0.003, cz);
        keyMesh.castShadow = true;
        keyboardGroup.add(keyMesh);

        // Label
        const fontPx = 56;
        const labelTex = getLabelTexture(ch, fontPx);
        const square = Math.min(kw * 0.78, halfH * 0.85);
        const labelGeo = new THREE.PlaneGeometry(square, square);
        const labelMat = new THREE.MeshBasicMaterial({
          map: labelTex,
          transparent: true,
          depthWrite: false,
        });
        const labelMesh = new THREE.Mesh(labelGeo, labelMat);
        labelMesh.rotation.x = -Math.PI / 2;
        labelMesh.position.set(cx, keyHeight + 0.005, cz);
        labelMesh.userData = { label: ch, fontPx };
        keyboardGroup.add(labelMesh);
        labelMeshes.push(labelMesh);
      });

      cursorX += kw + colGap;
      return;
    }

    const radius = Math.min(0.015, kh * 0.28);
    const segments = 2;

    const keyGeo = new RoundedBoxGeometry(kw, keyHeight, kh, segments, radius);
    const keyMesh = new THREE.Mesh(keyGeo, keyCapMat);
    const cx = cursorX + kw / 2;
    const cz = cursorZ + kh / 2;
    keyMesh.position.set(cx, keyHeight / 2 + 0.003, cz);
    keyMesh.castShadow = true;
    keyboardGroup.add(keyMesh);

    // Label plane on top of the key
    if (label) {
      // Choose font size based on label length and key size
      const isMulti = label.length > 1;
      const fontPx = isFunctionRow
        ? 48
        : isMulti
          ? Math.min(56, Math.floor(72 / Math.sqrt(label.length)))
          : 72;

      const labelTex = getLabelTexture(label, fontPx);

      // Plane size matches key but slightly inset
      const labelW = kw * 0.78;
      const labelH = kh * 0.78;
      // Use a square area to keep text un-stretched, sized to smaller dim
      const square = Math.min(labelW, labelH);

      const labelGeo = new THREE.PlaneGeometry(square, square);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        depthWrite: false,
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.rotation.x = -Math.PI / 2;
      labelMesh.position.set(cx, keyHeight + 0.005, cz);
      labelMesh.userData = { label, fontPx };
      keyboardGroup.add(labelMesh);
      labelMeshes.push(labelMesh);
    }

    cursorX += kw + colGap;
  });

  cursorZ += rowH + rowGap;
});

keyboardGroup.position.set(0, 0, kbCenterZ);
topDeck.add(keyboardGroup);

// ── Trackpad (large, like real MacBook Air) ─────────────────────────
const tpW = BASE_W * 0.50;
const tpD = BASE_D * 0.38;
const trackpadGeo = new THREE.ShapeGeometry(rrShape(tpW, tpD, 0.06));
trackpadGeo.rotateX(-Math.PI / 2);
const trackpadMesh = new THREE.Mesh(trackpadGeo, trackpadMat);
const trackpadZ = kbCenterZ + kbD / 2 + tpD / 2 + 0.05;
trackpadMesh.position.set(0, 0.003, trackpadZ);
topDeck.add(trackpadMesh);

// Sit flat on top of the slab
topDeck.position.set(0, BASE_THICKNESS + 0.001, 0);
laptop.add(topDeck);

// ── Hinge ────────────────────────────────────────────────────────────
const hingeGeo = new THREE.CylinderGeometry(HINGE_R, HINGE_R, BASE_W * 0.92, 20);
const hingeMesh = new THREE.Mesh(hingeGeo, hingeMat);
hingeMesh.rotation.z = Math.PI / 2;
hingeMesh.position.set(0, BASE_THICKNESS + HINGE_R * 0.3, -BASE_D / 2 + 0.04);
laptop.add(hingeMesh);

// ── Body-color feet (small protrusions, not rubber) ─────────────────
const FOOT_R = 0.055;
const FOOT_H = 0.018;
const footGeo = new THREE.CylinderGeometry(FOOT_R, FOOT_R * 0.85, FOOT_H, 24);
[
  [-BASE_W / 2 + 0.20, -BASE_D / 2 + 0.18],
  [ BASE_W / 2 - 0.20, -BASE_D / 2 + 0.18],
  [-BASE_W / 2 + 0.20,  BASE_D / 2 - 0.18],
  [ BASE_W / 2 - 0.20,  BASE_D / 2 - 0.18],
].forEach(([fx, fz]) => {
  const foot = new THREE.Mesh(footGeo, aluminum);
  foot.position.set(fx, -FOOT_H / 2, fz);
  laptop.add(foot);
});

// ── Position laptop so the feet rest on the ground ───────────────────
laptop.position.set(0, FOOT_H, 0);
scene.add(laptop);

// ── Post-processing (MSAA only) ─────────────────────────────────────
// EffectComposer bypasses the renderer's built-in MSAA, so we create a
// multi-sampled render target to keep edges smooth.
const composerTarget = new THREE.WebGLRenderTarget(
  window.innerWidth, window.innerHeight,
  {
    type: THREE.HalfFloatType,
    samples: 4, // 4x MSAA
  }
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// ── Soft shadow blob ─────────────────────────────────────────────────
const blobCanvas = document.createElement("canvas");
blobCanvas.width = 512;
blobCanvas.height = 512;
const bCtx = blobCanvas.getContext("2d");
const bGrad = bCtx.createRadialGradient(256, 256, 20, 256, 256, 220);
bGrad.addColorStop(0, "rgba(10,14,20,0.22)");
bGrad.addColorStop(0.6, "rgba(10,14,20,0.08)");
bGrad.addColorStop(1, "rgba(10,14,20,0)");
bCtx.fillStyle = bGrad;
bCtx.fillRect(0, 0, 512, 512);
const blobTex = new THREE.CanvasTexture(blobCanvas);
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 4),
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
);
blob.rotation.x = -Math.PI / 2;
blob.position.set(0, -0.005, 0.2);
scene.add(blob);

// ── Lid open/close ───────────────────────────────────────────────────
// 0 rad = closed (lid flat over keyboard), PI/2 = perpendicular, PI = flat back
let currentAngle = OPEN_ANGLE;
let targetAngle = OPEN_ANGLE;
const LID_MIN = 0.0;            // fully closed
const LID_MAX = Math.PI * 0.95; // ~171° (almost flat back)

function applyLidRotation(angle) {
  lidPivot.rotation.x = Math.PI / 2 - angle;
}

function setLidAngle(radians) {
  const clamped = Math.max(LID_MIN, Math.min(LID_MAX, radians));
  applyLidRotation(clamped);
  currentAngle = clamped;
  targetAngle = clamped;
}

// Arrow Up / Down to open and close
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    targetAngle = Math.min(LID_MAX, targetAngle + 0.08);
    syncSlider();
  } else if (e.key === "ArrowDown") {
    targetAngle = Math.max(LID_MIN, targetAngle - 0.08);
    syncSlider();
  }
});

// Slider control
const lidSlider = document.getElementById("lid-slider");
const lidLabel = document.getElementById("lid-angle");

function syncSlider() {
  if (lidSlider) {
    const deg = Math.round(targetAngle * (180 / Math.PI));
    lidSlider.value = deg;
    lidLabel.textContent = deg + "\u00B0";
  }
}

if (lidSlider) {
  lidSlider.addEventListener("input", () => {
    const deg = parseFloat(lidSlider.value);
    targetAngle = deg * (Math.PI / 180);
    lidLabel.textContent = Math.round(deg) + "\u00B0";
  });
}

// ── API ──────────────────────────────────────────────────────────────
function setActiveTexture(texture) {
  screenMat.map = texture;
  screenMat.needsUpdate = true;
}

// ── Color picker ─────────────────────────────────────────────────────
const macColors = {
  gray:  { body: 0x676e89, back: 0x565d75 },
  white: { body: 0xe6e7e9, back: 0xd2d3d5 },
  pink:  { body: 0xe6d5d4, back: 0xd0bebd },
  green: { body: 0xdbdf8c, back: 0xc4c876 },
};

// Mix two hex colors (returns hex int).
function mixHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const bC = Math.round(ab * (1 - t) + bb * t);
  return (r << 16) | (g << 8) | bC;
}

// Pick a label color that contrasts with the body.
function labelColorFor(bodyHex) {
  const r = (bodyHex >> 16) & 0xff;
  const g = (bodyHex >> 8) & 0xff;
  const b = bodyHex & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#3a4050" : "#cdd2dd";
}

function refreshLabelTextures() {
  // Dispose old textures and rebuild
  labelCache.forEach((tex) => tex.dispose());
  labelCache.clear();
  labelMeshes.forEach((mesh) => {
    const { label, fontPx } = mesh.userData;
    const newTex = getLabelTexture(label, fontPx);
    mesh.material.map = newTex;
    mesh.material.needsUpdate = true;
  });
}

function setLaptopColor(name) {
  const palette = macColors[name];
  if (!palette) return;
  // Body / lid
  aluminum.color.setHex(palette.body);
  aluminumDark.color.setHex(palette.back);
  // Plate (the keyboard well) — slightly darker than the body for a recessed look
  plateMat.color.setHex(mixHex(palette.body, 0x000000, 0.18));
  // Trackpad — also slightly darker than the body so it's visible
  trackpadMat.color.setHex(mixHex(palette.body, 0x000000, 0.12));
  // Keys: lighter than the body so they pop against the dark plate
  keyCapMat.color.setHex(mixHex(palette.body, 0xffffff, 0.20));
  // Labels: contrast-aware
  labelTextColor = labelColorFor(palette.body);
  refreshLabelTextures();
}

document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const name = swatch.dataset.color;
    setLaptopColor(name);
    document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
  });
});

// Default to gray and mark its swatch active
setLaptopColor("gray");
const defaultSwatch = document.querySelector('.swatch[data-color="gray"]');
if (defaultSwatch) defaultSwatch.classList.add("active");

window.mockup = {
  fabricCanvas,
  fabricTexture,
  laptop,
  lidPivot,
  setOpenAngle(radians) { setLidAngle(radians); },
  open()  { targetAngle = OPEN_ANGLE; },
  close() { targetAngle = LID_MIN; },
  useFabric() {
    setActiveTexture(fabricTexture);
    fabricTexture.needsUpdate = true;
  },
  useVideo(videoElement) {
    const vt = new THREE.VideoTexture(videoElement);
    vt.colorSpace = THREE.SRGBColorSpace;
    vt.minFilter = THREE.LinearFilter;
    vt.magFilter = THREE.LinearFilter;
    vt.generateMipmaps = false;
    setActiveTexture(vt);
    return vt;
  },
};

// ── Loop ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  // Smoothly animate lid toward target
  if (Math.abs(currentAngle - targetAngle) > 0.001) {
    currentAngle += (targetAngle - currentAngle) * 0.12;
    applyLidRotation(currentAngle);
  }

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
