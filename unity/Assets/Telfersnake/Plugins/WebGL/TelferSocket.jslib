// The browser's WebSocket for Telfer.Net.BrowserSocket. Nothing calls back into C#: frames wait in
// a queue per socket and the game polls them each frame. Strings returned to C# are _malloc'd here;
// IL2CPP frees them after marshalling. A null pointer (0) is a null string.
var TelferSocketLib = {
  $TelferSockets: { next: 1, all: {} },

  $TelferSocketString: function (str) {
    if (str === null || str === undefined) return 0;
    var size = lengthBytesUTF8(str) + 1;
    var buffer = _malloc(size);
    stringToUTF8(str, buffer, size);
    return buffer;
  },

  TelferSocket_Open: function (urlPtr) {
    var url = UTF8ToString(urlPtr);
    var id = TelferSockets.next++;
    var s = { ws: null, inbox: [], why: '' };
    TelferSockets.all[id] = s;
    try {
      s.ws = new WebSocket(url);
    } catch (e) {
      s.why = String((e && e.message) || e);
      return id;
    }
    s.ws.onmessage = function (e) {
      if (typeof e.data === 'string') s.inbox.push(e.data);
    };
    s.ws.onerror = function () {
      if (!s.why) s.why = 'error';
    };
    s.ws.onclose = function (e) {
      s.why = e.code + ' ' + (e.reason || '');
    };
    return id;
  },

  // 0 connecting, 1 open, 2 closing or closed (or unknown).
  TelferSocket_State: function (id) {
    var s = TelferSockets.all[id];
    if (!s || !s.ws) return 2;
    var r = s.ws.readyState;
    return r === 0 ? 0 : r === 1 ? 1 : 2;
  },

  TelferSocket_Send: function (id, textPtr) {
    var s = TelferSockets.all[id];
    if (!s || !s.ws || s.ws.readyState !== 1) return 0;
    s.ws.send(UTF8ToString(textPtr));
    return 1;
  },

  TelferSocket_Receive: function (id) {
    var s = TelferSockets.all[id];
    if (!s || s.inbox.length === 0) return 0;
    return TelferSocketString(s.inbox.shift());
  },

  TelferSocket_Why: function (id) {
    var s = TelferSockets.all[id];
    return TelferSocketString(s ? s.why : 'closed');
  },

  TelferSocket_Close: function (id) {
    var s = TelferSockets.all[id];
    if (!s) return;
    delete TelferSockets.all[id];
    if (s.ws && s.ws.readyState < 2) {
      try { s.ws.close(1000, 'bye'); } catch (e) {}
    }
  },

  // The page address, so the game can find its server (and read ?server=).
  TelferSocket_PageUrl: function () {
    return TelferSocketString(window.location.href);
  },
};

['TelferSocket_Open', 'TelferSocket_State', 'TelferSocket_Send', 'TelferSocket_Receive', 'TelferSocket_Why', 'TelferSocket_Close', 'TelferSocket_PageUrl'].forEach(function (name) {
  TelferSocketLib[name + '__deps'] = ['$TelferSockets', '$TelferSocketString'];
});
mergeInto(LibraryManager.library, TelferSocketLib);
