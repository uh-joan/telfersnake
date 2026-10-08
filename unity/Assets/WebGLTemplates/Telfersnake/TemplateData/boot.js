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

  // Classic or HD: opening HD makes it the version to come back to (key shared with the classic
  // game's src/ui/versionSwitch.ts and public/version.js, which opens it straight away next time).
  const VERSION_KEY = "telfersnake.version";
  try { localStorage.setItem(VERSION_KEY, "hd"); } catch (e) { /* not remembered, still works */ }

  // The switch on the HD title calls this: the classic game's sky grows from the finger (x, y as
  // fractions of the screen, from the bottom left), then the page changes under it.
  window.telferSwitchToClassic = (x, y) => {
    try { localStorage.setItem(VERSION_KEY, "classic"); } catch (e) { /* still switches */ }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sky = document.createElement("div");
    sky.id = "warp";
    sky.innerHTML = '<div class="warp-logo">Telfer<b>snake</b></div>';
    sky.style.setProperty("--x", (x * 100).toFixed(1) + "%");
    sky.style.setProperty("--y", ((1 - y) * 100).toFixed(1) + "%");
    document.body.appendChild(sky);
    requestAnimationFrame(() => requestAnimationFrame(() => sky.classList.add("open")));
    setTimeout(() => location.replace(new URL("../", location.href).href), reduced ? 120 : 520);
  };
  // Back from Classic through the browser's page cache: no sky left over.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    document.getElementById("warp")?.remove();
    try { localStorage.setItem(VERSION_KEY, "hd"); } catch (err) { /* fine */ }
  });

  // The bar is a snake: as it grows past a snack, the snack is eaten.
  const snacks = [...document.querySelectorAll(".snack")].map((el) => ({ el, at: parseFloat(el.style.left) }));
  const grow = (percent) => {
    fill.style.width = percent + "%";
    for (const s of snacks) if (!s.el.classList.contains("eaten") && percent + 3 >= s.at) s.el.classList.add("eaten");
  };

  createUnityInstance(document.querySelector("#unity-canvas"), config, (p) => grow(Math.round(4 + p * 96)))
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
      grow(100);
      setTimeout(() => loader.classList.add("gone"), 900);
    })
    .catch((message) => { document.querySelector("#hint").textContent = "Oops: " + message; });
})();
