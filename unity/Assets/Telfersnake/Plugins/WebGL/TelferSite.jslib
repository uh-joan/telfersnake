// The web page around the game: the Classic/HD switch hands over to the page (TemplateData/boot.js),
// which grows the classic game's sky from the finger and changes page under it.
mergeInto(LibraryManager.library, {
  // x, y: where the finger was, as fractions of the screen from the bottom left.
  TelferSite_ToClassic: function (x, y) {
    if (typeof window.telferSwitchToClassic === 'function') window.telferSwitchToClassic(x, y);
    else window.location.replace('/');
  },
});
