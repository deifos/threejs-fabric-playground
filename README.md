# Three.js + Fabric Playground

A small open-source playground for building 3D device mockups in the browser
with [Three.js](https://threejs.org) and [Fabric.js](http://fabricjs.com). It
ships with two ready-to-use mockups — a **MacBook Air** and an **iPhone** —
both modelled procedurally with no external 3D assets.

The goal is to provide a foundation you can drop your own screen content
(an image, a Fabric canvas, or a `<video>`) into and immediately render a
clean, interactive 3D mockup of it.

## Features

- **Procedural geometry** — every part of the laptop and phone is built from
  Three.js primitives (`ExtrudeGeometry`, `RoundedBoxGeometry`,
  `ShapeGeometry`, `BoxGeometry`, etc.). No `.glb`/`.obj` files to ship.
- **PBR materials** — `MeshPhysicalMaterial` with clearcoat for the anodized
  aluminum bodies, plus `RoomEnvironment` for realistic image-based lighting.
- **Live texture pipeline** — the laptop screen reads from a Fabric canvas via
  `THREE.CanvasTexture`, so anything you draw with Fabric updates the 3D
  display in real time. You can also swap in a `THREE.VideoTexture` or a
  static `TextureLoader` image.
- **Interactive controls** — `OrbitControls` for rotating the device, a
  vertical slider for opening/closing the laptop lid, and a swatch picker for
  switching between four anodized colors per device.
- **Depth of field overlay** — a non-destructive CSS `backdrop-filter` DoF
  effect with **Radial** and **Linear** modes, blur + focus + angle sliders,
  shared between both mockups.
- **MSAA via post-processing** — an `EffectComposer` pipeline with a
  multi-sampled render target keeps edges smooth without losing the option to
  add more passes (bloom, SSAO, FXAA…) later.
- **Multi-page Vite setup** — laptop and phone live on separate HTML entry
  points (`/` and `/iphone.html`) and share the same `vite.config.js` build
  pipeline.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`). Use the
top-left toggle to switch between the **Laptop** and **iPhone** views.

To build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
.
├── index.html              # Laptop mockup page
├── iphone.html             # iPhone mockup page
├── public/
│   ├── screen.png          # Default laptop screen image
│   └── iphone-screen.png   # Default iPhone screen image
├── src/
│   ├── main.js             # Laptop scene + Fabric integration
│   ├── iphone.js           # iPhone scene
│   └── dof.js              # Shared depth-of-field panel logic
└── vite.config.js          # Multi-page Vite config
```

## Mockups

### MacBook Air (`/`)

A modern MacBook Air built from extruded rounded rectangles with a beveled
slab for the base, full keyboard with realistic key layout (function row,
QWERTY, ASDF, ZXCV, bottom row with stacked arrow keys), wide trackpad,
hinge, side ports, speaker grilles, lift notch, and four anodized colors.

**Controls**

- Drag — orbit the camera
- Scroll — zoom
- Vertical slider (right edge) — open or close the lid
- Color swatches (bottom) — Gray, White, Pink, Green
- `↑` / `↓` arrow keys — nudge the lid open/closed

**Screen content**

The laptop screen is texture-mapped from a Fabric canvas. By default the
screen displays a static `screen.png`, but you can replace it at runtime:

```js
// Use the live Fabric canvas as the screen content
window.mockup.useFabric();

// Pipe a video element into the screen
const video = document.querySelector("video");
video.play();
window.mockup.useVideo(video);

// Set the lid open angle in radians (0 = closed, π = flat)
window.mockup.setOpenAngle(Math.PI / 2);
```

### iPhone (`/iphone.html`)

A modern iPhone with a heavily rounded silhouette, dynamic island, wide
camera plateau on the back, side buttons (action / volume up / volume down /
power), USB-C port, speaker grille, and four colors.

**Controls**

- Drag — orbit the camera
- Scroll — zoom
- Color swatches — Sky Blue, Black, White, Pink

**Screen content**

The iPhone screen loads `iphone-screen.png` by default. You can swap it via
the global `window.mockup` API.

## Depth of field

Both pages include a shared depth-of-field panel (top-right) that applies a
CSS `backdrop-filter` blur behind a gradient mask. It's a 2D effect — no
extra 3D passes — so it's free and works on top of anything in the scene.

Modes:

- **Off** — no blur
- **Radial** — elliptical sharp zone centered on the focus point, blurred
  edges. Simulates a macro lens or a tilt-shift center-focus look.
- **Linear** — a horizontal (or rotated) sharp band, blurred above and
  below. Simulates a camera focusing on a tilted focal plane.

Sliders:

- **Blur** — blur radius in pixels (0–20)
- **Focus** — where the sharp area sits along the gradient axis (0–100%)
- **Angle** — rotation of the sharp band (Linear mode only, 0–360°).
  `0° / 180°` = horizontal band, `90° / 270°` = vertical band, `45°` =
  diagonal.

The effect is implemented in `src/dof.js` and shared between both pages.
The module auto-initializes when it finds a `.dof-panel` in the DOM and
injects a full-page `.dof-overlay` element that actually performs the
blur.

## Replacing the screen images

Drop any PNG or JPG into the `public/` folder and reference it from
`src/main.js` (laptop) or `src/iphone.js` (phone) at the `TextureLoader.load`
call.

For best results:

- **Laptop**: aspect ratio close to 16:10 (matches the screen plane)
- **iPhone**: portrait, around 19.5:9

## Customizing

- **Add a color**: edit the `macColors` (laptop) or `phoneColors` (phone)
  object near the bottom of the corresponding source file and add a new
  swatch button to the HTML.
- **Tweak proportions**: every dimension is a named constant at the top of
  the file (`PHONE_W`, `BASE_THICKNESS`, `BEVEL_T`, etc.).
- **Add post-processing**: the `EffectComposer` is already wired up. To add a
  bloom pass:

  ```js
  import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.1,  // strength
      0.4,  // radius
      0.98  // threshold
    )
  );
  ```

  (Insert before the `OutputPass`.)

## Tech stack

- [Three.js](https://threejs.org) — WebGL rendering
- [Fabric.js](http://fabricjs.com) — 2D canvas → texture pipeline
- [Vite](https://vite.dev) — dev server + build

## License

MIT — do whatever you want with it. Contributions welcome.
