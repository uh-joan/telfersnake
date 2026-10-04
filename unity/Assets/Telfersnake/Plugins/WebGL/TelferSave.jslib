// The browser's localStorage for Telfer.Meta.Profile, so the remaster shares the web game's save
// (one wallet of stars, gems and Tuck Shop buys for both). Storage can be missing or blocked
// (private windows): every access is guarded, and a failed read is just an empty save.
var TelferSaveLib = {
  // The stored string, or null (0) when there is none. _malloc'd here; IL2CPP frees it.
  TelferSave_Read: function (keyPtr) {
    var value = null;
    try { value = window.localStorage.getItem(UTF8ToString(keyPtr)); } catch (e) { value = null; }
    if (value === null || value === undefined) return 0;
    var size = lengthBytesUTF8(value) + 1;
    var buffer = _malloc(size);
    stringToUTF8(value, buffer, size);
    return buffer;
  },

  // 1 when it is safely stored, 0 when storage is full or blocked.
  TelferSave_Write: function (keyPtr, valuePtr) {
    try {
      window.localStorage.setItem(UTF8ToString(keyPtr), UTF8ToString(valuePtr));
      return 1;
    } catch (e) {
      return 0;
    }
  },
};
mergeInto(LibraryManager.library, TelferSaveLib);
