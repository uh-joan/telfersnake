using System;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#else
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
#endif

namespace Telfer.Net
{
    public enum SocketState { Connecting, Open, Closed }

    /// <summary>
    /// A text WebSocket polled from the main thread: nothing calls back into game code. The browser
    /// build uses the page's WebSocket (TelferSocket.jslib); everything else ClientWebSocket.
    /// </summary>
    public interface ISocket
    {
        SocketState State { get; }
        /// <summary>Why it closed (close code and reason, or the error), once Closed.</summary>
        string Why { get; }
        /// <summary>Queues one text frame; dropped unless Open.</summary>
        void Send(string text);
        /// <summary>The next received frame, oldest first.</summary>
        bool TryReceive(out string text);
        void Close();
    }

    public static class Sockets
    {
        /// <summary>
        /// Sent by desktop and editor clients. Production only lets in sockets from its own page
        /// (ALLOWED_ORIGINS), and a missing Origin is turned away, so name it. Browsers set their own.
        /// </summary>
        public static string Origin = "https://telfersnake.joans.cat";

        public static ISocket Open(string url)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new BrowserSocket(url);
#else
            return new DesktopSocket(url, Origin);
#endif
        }
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    /// <summary>The page's own WebSocket; frames wait in a JS queue until polled.</summary>
    sealed class BrowserSocket : ISocket
    {
        [DllImport("__Internal")] static extern int TelferSocket_Open(string url);
        [DllImport("__Internal")] static extern int TelferSocket_State(int id);
        [DllImport("__Internal")] static extern int TelferSocket_Send(int id, string text);
        [DllImport("__Internal")] static extern string TelferSocket_Receive(int id);
        [DllImport("__Internal")] static extern string TelferSocket_Why(int id);
        [DllImport("__Internal")] static extern void TelferSocket_Close(int id);

        readonly int id;
        public BrowserSocket(string url) { id = TelferSocket_Open(url); }

        // 0 connecting, 1 open, 2 closing or closed (the JS side keeps unread frames until drained).
        public SocketState State
        {
            get { int s = id > 0 ? TelferSocket_State(id) : 2; return s == 0 ? SocketState.Connecting : s == 1 ? SocketState.Open : SocketState.Closed; }
        }

        public string Why => id > 0 ? TelferSocket_Why(id) ?? "" : "could not open";
        public void Send(string text) { if (id > 0) TelferSocket_Send(id, text); }

        public bool TryReceive(out string text)
        {
            text = id > 0 ? TelferSocket_Receive(id) : null;
            return text != null;
        }

        public void Close() { if (id > 0) TelferSocket_Close(id); }
    }
#else
    /// <summary>ClientWebSocket pumped by two background tasks; the game thread only touches the queues.</summary>
    sealed class DesktopSocket : ISocket
    {
        readonly ClientWebSocket ws = new ClientWebSocket();
        readonly CancellationTokenSource stop = new CancellationTokenSource();
        readonly ConcurrentQueue<string> inbox = new ConcurrentQueue<string>(), outbox = new ConcurrentQueue<string>();
        readonly SemaphoreSlim outboxReady = new SemaphoreSlim(0);
        volatile SocketState state = SocketState.Connecting;
        volatile string why = "";
        volatile bool pumping;

        public DesktopSocket(string url, string origin)
        {
            if (!string.IsNullOrEmpty(origin)) ws.Options.SetRequestHeader("Origin", origin);
            ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
            Task.Run(() => Run(new Uri(url)));
        }

        public SocketState State => state;
        public string Why => why;

        public void Send(string text)
        {
            if (state != SocketState.Open) return;
            outbox.Enqueue(text);
            outboxReady.Release();
        }

        public bool TryReceive(out string text) => inbox.TryDequeue(out text);

        public void Close()
        {
            if (state == SocketState.Open)
            {
                // Say goodbye properly: the sender writes the close frame after anything still queued.
                why = "closed by us";
                state = SocketState.Closed;
                outbox.Enqueue(null);
                outboxReady.Release();
            }
            else Finish("closed by us");
        }

        void Finish(string reason)
        {
            if (state != SocketState.Closed) { why = reason; state = SocketState.Closed; }
            if (!stop.IsCancellationRequested) stop.Cancel();
        }

        void Dispose() { try { ws.Dispose(); } catch (Exception) { } }

        async Task Run(Uri uri)
        {
            try
            {
                await ws.ConnectAsync(uri, stop.Token).ConfigureAwait(false);
                if (state == SocketState.Closed) throw new OperationCanceledException();
                state = SocketState.Open;
                pumping = true;
                _ = Task.Run(Pump);
                var buffer = new byte[16 * 1024];
                var text = new StringBuilder();
                var decoder = Encoding.UTF8.GetDecoder();
                var chars = new char[buffer.Length];
                while (!stop.IsCancellationRequested)
                {
                    var r = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), stop.Token).ConfigureAwait(false);
                    if (r.MessageType == WebSocketMessageType.Close)
                    {
                        Finish(((int?)r.CloseStatus ?? 1005) + " " + r.CloseStatusDescription);
                        break;
                    }
                    int n = decoder.GetChars(buffer, 0, r.Count, chars, 0, r.EndOfMessage);
                    text.Append(chars, 0, n);
                    if (!r.EndOfMessage) continue;
                    if (r.MessageType == WebSocketMessageType.Text) inbox.Enqueue(text.ToString());
                    text.Clear();
                }
            }
            catch (Exception e)
            {
                Finish(e is OperationCanceledException ? "closed by us" : e.GetBaseException().Message);
            }
            Finish(why);
            if (!pumping) Dispose(); // otherwise the sender does, after its goodbye
        }

        /// <summary>One sender at a time: ClientWebSocket forbids overlapping sends.</summary>
        async Task Pump()
        {
            try
            {
                while (!stop.IsCancellationRequested)
                {
                    await outboxReady.WaitAsync(stop.Token).ConfigureAwait(false);
                    if (!outbox.TryDequeue(out var text)) continue;
                    if (text == null)
                    {
                        using (var wait = new CancellationTokenSource(1000))
                            await ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "bye", wait.Token).ConfigureAwait(false);
                        break;
                    }
                    var bytes = Encoding.UTF8.GetBytes(text);
                    await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, stop.Token).ConfigureAwait(false);
                }
            }
            catch (Exception e)
            {
                if (!(e is OperationCanceledException)) Finish(e.GetBaseException().Message);
            }
            Finish(why);
            Dispose();
        }
    }
#endif
}
