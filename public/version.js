// Opens the version this player picked last on the home screen's Classic/HD switch, before the
// classic game starts loading. A plain script in <head> (the site's CSP allows no inline script).
// The key is shared with src/ui/versionSwitch.ts and the HD page's TemplateData/boot.js.
(function () {
  try {
    if (location.pathname !== '/') return;
    // ?classic opens Classic whatever was picked before, and makes it the choice.
    if (/[?&]classic(=|&|$)/.test(location.search)) {
      localStorage.setItem('telfersnake.version', 'classic');
      return;
    }
    if (localStorage.getItem('telfersnake.version') !== 'hd') return;
    if (!document.createElement('canvas').getContext('webgl2')) return;
    location.replace('/hd/' + location.search);
  } catch (e) {
    // Storage or WebGL blocked: stay on Classic.
  }
})();
