using System;
using System.Collections.Generic;
using System.Diagnostics;
using Telfer.Sim;
using UnityEngine;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace Telfer.Net
{
    public enum NetState { Connecting, Joined, Failed, Closed }

    /// <summary>
    /// A seat in a shared playground (port of src/net/client.ts Connection). Poll it once a frame on
    /// the main thread: it drains the socket, keeps the state and hands back the parsed messages.
    /// Failed means we never got in (the game plays solo); Closed means we were in and are not now.
    /// </summary>
    public sealed class Connection
    {
        /// <summary>A child is waiting on the Play button: give up quickly and play offline.</summary>
        public const int WELCOME_TIMEOUT_MS = 2500;
        /// <summary>Nothing heard for this long while seated means the line is gone.</summary>
        public const int SILENCE_MS = 8000;
        /// <summary>Under the server's 90 per second, with room for the odd menu message.</summary>
        const int SEND_BUDGET = 80;

        readonly ISocket socket;
        readonly string hello;
        readonly Stopwatch clock = Stopwatch.StartNew();
        readonly List<ServerMessage> received = new List<ServerMessage>();
        bool helloSent;
        long heardAt, windowStart;
        int sentInWindow;

        public NetState State { get; private set; } = NetState.Connecting;
        /// <summary>Why it failed or closed: 'offline', 'lost', 'left', or the server's sorry ('full', 'old', 'busy').</summary>
        public string Why { get; private set; } = "";
        /// <summary>Set once seated.</summary>
        public Welcome Welcome { get; private set; }
        public string Url { get; }
        /// <summary>Milliseconds since the last frame from the server (or since connecting).</summary>
        public long SinceHeardMs => clock.ElapsedMilliseconds - heardAt;

        Connection(string url, string hello)
        {
            Url = url;
            this.hello = hello;
            try { socket = Sockets.Open(url); }
            catch (Exception e) { Fail("offline"); UnityEngine.Debug.LogWarning("Telfer.Net: " + e.Message); }
        }

        /// <summary>Opens the socket and asks for a seat; hello is a <see cref="ClientMessage.Hello"/>.</summary>
        public static Connection Join(string url, string hello) => new Connection(url, hello);

        public static Connection Join(Mode mode, StageId stage, bool canBuy, string skin, string hat, string trail, string name)
            => Join(ServerUrl.Resolve(), ClientMessage.Hello(mode, stage, canBuy, skin, hat, trail, name));

        /// <summary>
        /// Drains the socket and returns what arrived, oldest first (Welcome included, once). The list
        /// is reused: read it before the next Poll.
        /// </summary>
        public List<ServerMessage> Poll()
        {
            received.Clear();
            if (socket == null || State == NetState.Failed || State == NetState.Closed) return received;

            if (!helloSent && socket.State == SocketState.Open)
            {
                helloSent = true;
                Send(hello);
            }
            while (socket.TryReceive(out var text))
            {
                heardAt = clock.ElapsedMilliseconds;
                var m = Protocol.Parse(text);
                if (m == null) continue;
                if (State == NetState.Connecting)
                {
                    if (m is Welcome w) { Welcome = w; State = NetState.Joined; }
                    else if (m is Sorry s) { Fail(s.why); return received; }
                    else continue; // nothing else means anything before the welcome
                }
                received.Add(m);
            }

            if (State == NetState.Connecting)
            {
                if (socket.State == SocketState.Closed) Fail("offline");
                else if (clock.ElapsedMilliseconds > WELCOME_TIMEOUT_MS) Fail("offline");
            }
            else if (socket.State == SocketState.Closed || SinceHeardMs > SILENCE_MS) End("lost");
            return received;
        }

        /// <summary>Why the socket itself closed (close code and reason), for logs.</summary>
        public string SocketWhy => socket?.Why ?? "";

        // ------------------------------------------------------------ sending

        /// <summary>
        /// The thumb, once per 1/60 s sim step with that step's counter q. Only even q goes up (30 Hz),
        /// as the web client does; the server acks the highest q it has applied.
        /// </summary>
        public void Input(int q, float x, float z, bool active, bool dash)
        {
            if (q % 2 == 0) SendSeated(ClientMessage.Input(q, x, z, active, dash));
        }

        public void Pick(int index) => SendSeated(ClientMessage.Pick(index));
        /// <summary>In a menu: the server stands my snake aside, frozen and safe (repeat every 8 s while away).</summary>
        public void Away(bool on) => SendSeated(ClientMessage.Away(on));
        /// <summary>Whether I have a gem to spend, so the server knows whether to offer power cards.</summary>
        public void SetCanBuy(bool on) => SendSeated(ClientMessage.Gems(on));
        /// <summary>Changed clothes or name mid-game: everyone in the room sees it.</summary>
        public void Wear(string skin, string hat, string trail, string name) => SendSeated(ClientMessage.Look(skin, hat, trail, name));

        /// <summary>Give the seat back (it becomes a bot again).</summary>
        public void Leave()
        {
            if (State == NetState.Connecting) Fail("left");
            else End("left");
        }

        void SendSeated(string text)
        {
            if (State == NetState.Joined) Send(text);
        }

        void Send(string text)
        {
            if (text.Length > Protocol.MAX_MESSAGE) { UnityEngine.Debug.LogWarning("Telfer.Net: message too big, not sent"); return; }
            long now = clock.ElapsedMilliseconds;
            if (now - windowStart >= 1000) { windowStart = now; sentInWindow = 0; }
            if (sentInWindow >= SEND_BUDGET) return; // the server closes sockets that chatter
            sentInWindow++;
            socket.Send(text);
        }

        void Fail(string why)
        {
            State = NetState.Failed;
            Why = why;
            socket?.Close();
        }

        void End(string why)
        {
            if (State == NetState.Closed) return;
            State = NetState.Closed;
            Why = why;
            socket?.Close();
        }
    }

    /// <summary>
    /// Where the server is. An override wins (code, `-server url` on the command line, or `?server=` on
    /// the page). Otherwise: the editor and dev builds use localhost; a WebGL page uses its own host
    /// (like src/net/client.ts), or port 8787 of it when the page comes from some other port (a local
    /// static server); a release desktop build uses production.
    /// </summary>
    public static class ServerUrl
    {
        public const string LOCAL = "ws://localhost:8787/play", PRODUCTION = "wss://telfersnake.joans.cat/play";
        public const int PORT = 8787;

        /// <summary>Set from code to force a server.</summary>
        public static string Override;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern string TelferSocket_PageUrl();
#endif

        public static string Resolve()
        {
            if (!string.IsNullOrEmpty(Override)) return Override;
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i + 1 < args.Length; i++)
                if (args[i] == "-server") return args[i + 1];
#if UNITY_WEBGL && !UNITY_EDITOR
            return FromPage(TelferSocket_PageUrl());
#else
            return Application.isEditor || UnityEngine.Debug.isDebugBuild ? LOCAL : PRODUCTION;
#endif
        }

        /// <summary>The server for a page at <paramref name="href"/>.</summary>
        public static string FromPage(string href)
        {
            if (!Uri.TryCreate(href, UriKind.Absolute, out var page)) return LOCAL;
            string query = page.Query.TrimStart('?');
            foreach (var part in query.Split('&'))
                if (part.StartsWith("server=", StringComparison.Ordinal))
                    return Uri.UnescapeDataString(part.Substring(7));
            string scheme = page.Scheme == "https" ? "wss" : "ws";
            string host = page.IsDefaultPort ? page.Host : page.Host + ":" + PORT;
            return scheme + "://" + host + "/play";
        }
    }
}
