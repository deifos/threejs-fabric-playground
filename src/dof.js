// Depth of field overlay
//
// Applies a CSS backdrop-filter blur behind a gradient mask so that only
// part of the scene stays sharp. This is a 2D effect that affects the
// entire page uniformly — it looks like a camera lens DoF without needing
// an expensive 3D BokehPass.
//
// Modes:
//   - none:         off
//   - radial:       elliptical sharp area in the middle, blurred edges
//   - directional:  horizontal band stays sharp, top + bottom blurred
//                   (simulates a tilted focal plane)
//
// The panel exposes tab buttons, a blur-amount slider, and a focus-position
// slider. The overlay element is injected into the DOM if it doesn't
// already exist, so the pages only need the control markup.

function initDof() {
  const panel = document.querySelector(".dof-panel");
  if (!panel) return;

  // Inject the overlay element (the thing that actually blurs the page)
  let overlay = document.querySelector(".dof-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "dof-overlay";
    document.body.appendChild(overlay);
  }

  const tabs = panel.querySelectorAll(".dof-tab");
  const amount = panel.querySelector("#dof-amount");
  const position = panel.querySelector("#dof-position");
  const angle = panel.querySelector("#dof-angle");
  const amountLabel = panel.querySelector("#dof-amount-label");
  const positionLabel = panel.querySelector("#dof-position-label");
  const angleLabel = panel.querySelector("#dof-angle-label");
  const angleRow = panel.querySelector('[data-row="angle"]');

  let mode = "none";

  function radialMask(focus) {
    // focus is 0..100 (percent from top). Center vertically on that point.
    return (
      `radial-gradient(ellipse 60% 50% at 50% ${focus}%, ` +
      `rgba(0,0,0,0) 0%, ` +
      `rgba(0,0,0,0) 35%, ` +
      `rgba(0,0,0,0.8) 75%, ` +
      `rgba(0,0,0,1) 100%)`
    );
  }

  function directionalMask(focus, angleDeg) {
    // A sharp band perpendicular to the gradient direction, with soft
    // blur zones on either side. `angleDeg` rotates the gradient line:
    //   0°   = horizontal band (bands run top→bottom)
    //   90°  = vertical band (bands run left→right)
    //   45°  = diagonal band
    const f = Number(focus);
    const band = 18; // half-width of the sharp band in percent
    const soft = 22; // distance from the band edge to full blur
    return (
      `linear-gradient(${angleDeg}deg, ` +
      `rgba(0,0,0,1) 0%, ` +
      `rgba(0,0,0,1) ${Math.max(0, f - band - soft)}%, ` +
      `rgba(0,0,0,0) ${Math.max(0, f - band)}%, ` +
      `rgba(0,0,0,0) ${Math.min(100, f + band)}%, ` +
      `rgba(0,0,0,1) ${Math.min(100, f + band + soft)}%, ` +
      `rgba(0,0,0,1) 100%)`
    );
  }

  function update() {
    const blur = amount.value;
    const focus = position.value;
    const angleVal = angle ? angle.value : 180;

    if (amountLabel) amountLabel.textContent = `${blur}px`;
    if (positionLabel) positionLabel.textContent = `${focus}%`;
    if (angleLabel) angleLabel.textContent = `${angleVal}°`;

    // Only show the angle row when Linear mode is active
    if (angleRow) angleRow.style.display = mode === "directional" ? "flex" : "none";

    if (mode === "none") {
      overlay.style.opacity = "0";
      return;
    }

    overlay.style.opacity = "1";
    overlay.style.backdropFilter = `blur(${blur}px)`;
    overlay.style.webkitBackdropFilter = `blur(${blur}px)`;

    const maskImg = mode === "radial"
      ? radialMask(focus)
      : directionalMask(focus, angleVal);
    overlay.style.maskImage = maskImg;
    overlay.style.webkitMaskImage = maskImg;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.mode;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      update();
    });
  });

  amount.addEventListener("input", update);
  position.addEventListener("input", update);
  if (angle) angle.addEventListener("input", update);

  update();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDof);
} else {
  initDof();
}
