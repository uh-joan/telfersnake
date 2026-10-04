// Starts the game: kept out of index.html so the site's CSP can forbid inline script.
(() => {
  const fill = document.querySelector("#fill");
  const loader = document.querySelector("#loader");
  const config = JSON.parse(document.querySelector("#unity-config").textContent);
  config.arguments = [];
  // Retina at full density is a lot of pixels for a browser GPU: cap it.
  config.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

  // iPhones silence Web Audio when the side switch is on "silent" unless we ask for a playback
  // session (iOS 16.4+). No permission prompt: it just lets the game be heard with the ringer off.
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) {
    // Older or locked-down browser: it plays when the ringer is on.
  }

  createUnityInstance(document.querySelector("#unity-canvas"), config, (p) => {
    fill.style.width = Math.round(10 + p * 90) + "%";
  })
    .then((unity) => {
      window.unityInstance = unity;
      // Screen.safeArea knows nothing of notches in a browser: measure them in CSS and pass them on.
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;" +
        "left:env(safe-area-inset-left);bottom:env(safe-area-inset-bottom);right:env(safe-area-inset-right);top:env(safe-area-inset-top)";
      document.body.appendChild(probe);
      const insets = () => {
        const s = getComputedStyle(probe), w = innerWidth || 1, h = innerHeight || 1;
        const f = (v, d) => (parseFloat(v) || 0) / d;
        unity.SendMessage("Telfersnake", "SafeInsets",
          [f(s.left, w), f(s.bottom, h), f(s.right, w), f(s.top, h)].map((n) => n.toFixed(4)).join(","));
      };
      // The game object may not exist the moment the promise resolves: say it again shortly after.
      insets(); setTimeout(insets, 500); setTimeout(insets, 2000);
      addEventListener("resize", () => setTimeout(insets, 100));
      addEventListener("orientationchange", () => setTimeout(insets, 300));
      fill.style.width = "100%";
      setTimeout(() => loader.classList.add("gone"), 900);
    })
    .catch((message) => { document.querySelector("#hint").textContent = "Oops: " + message; });
})();
