using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Telfer.Net
{
    /// <summary>
    /// Just enough JSON for the game socket, with no reflection (IL2CPP/WebGL safe). Objects become
    /// Dictionary&lt;string, object&gt;, arrays List&lt;object&gt;, numbers double, plus string, bool and null.
    /// </summary>
    public static class Json
    {
        public static object Parse(string text)
        {
            var p = new Reader(text);
            p.Space();
            var v = p.Value();
            p.Space();
            if (p.i != text.Length) throw new FormatException("JSON: trailing text at " + p.i);
            return v;
        }

        /// <summary>Parse, or null on anything malformed (a bad frame is dropped, never fatal).</summary>
        public static Dictionary<string, object> TryParseObject(string text)
        {
            try { return Parse(text) as Dictionary<string, object>; }
            catch (Exception) { return null; }
        }

        struct Reader
        {
            readonly string s;
            public int i;
            static readonly double[] TENTHS = { 1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12, 1e-13, 1e-14, 1e-15 };

            public Reader(string s) { this.s = s; i = 0; }

            public void Space()
            {
                while (i < s.Length) { char c = s[i]; if (c == ' ' || c == '\n' || c == '\r' || c == '\t') i++; else break; }
            }

            FormatException Bad(string what) => new FormatException("JSON: " + what + " at " + i);

            public object Value()
            {
                if (i >= s.Length) throw Bad("unexpected end");
                char c = s[i];
                switch (c)
                {
                    case '{': return Obj();
                    case '[': return Arr();
                    case '"': return Str();
                    case 't': Word("true"); return true;
                    case 'f': Word("false"); return false;
                    case 'n': Word("null"); return null;
                    default: return Num();
                }
            }

            void Word(string w)
            {
                if (string.CompareOrdinal(s, i, w, 0, w.Length) != 0) throw Bad("expected " + w);
                i += w.Length;
            }

            Dictionary<string, object> Obj()
            {
                var d = new Dictionary<string, object>();
                i++; Space();
                if (i < s.Length && s[i] == '}') { i++; return d; }
                while (true)
                {
                    Space();
                    if (i >= s.Length || s[i] != '"') throw Bad("expected key");
                    string key = Str();
                    Space();
                    if (i >= s.Length || s[i] != ':') throw Bad("expected :");
                    i++; Space();
                    d[key] = Value();
                    Space();
                    if (i >= s.Length) throw Bad("unexpected end");
                    if (s[i] == ',') { i++; continue; }
                    if (s[i] == '}') { i++; return d; }
                    throw Bad("expected , or }");
                }
            }

            List<object> Arr()
            {
                var a = new List<object>();
                i++; Space();
                if (i < s.Length && s[i] == ']') { i++; return a; }
                while (true)
                {
                    Space();
                    a.Add(Value());
                    Space();
                    if (i >= s.Length) throw Bad("unexpected end");
                    if (s[i] == ',') { i++; continue; }
                    if (s[i] == ']') { i++; return a; }
                    throw Bad("expected , or ]");
                }
            }

            string Str()
            {
                i++;
                int start = i;
                // Fast path: no escapes.
                while (i < s.Length && s[i] != '"' && s[i] != '\\') i++;
                if (i < s.Length && s[i] == '"') { i++; return s.Substring(start, i - 1 - start); }
                var sb = new StringBuilder();
                sb.Append(s, start, i - start);
                while (i < s.Length)
                {
                    char c = s[i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (i >= s.Length) break;
                    char e = s[i++];
                    switch (e)
                    {
                        case 'n': sb.Append('\n'); break;
                        case 't': sb.Append('\t'); break;
                        case 'r': sb.Append('\r'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'u':
                            if (i + 4 > s.Length) throw Bad("bad \\u");
                            sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            i += 4; break;
                        default: sb.Append(e); break; // \" \\ \/
                    }
                }
                throw Bad("unterminated string");
            }

            /// <summary>Plain decimals (all the server sends) are read by hand; anything exotic goes to double.Parse.</summary>
            double Num()
            {
                int start = i;
                bool neg = false;
                if (s[i] == '-') { neg = true; i++; }
                long whole = 0; int digits = 0;
                while (i < s.Length && s[i] >= '0' && s[i] <= '9') { whole = whole * 10 + (s[i] - '0'); i++; digits++; }
                if (digits == 0) throw Bad("bad number");
                long frac = 0; int fd = 0;
                if (i < s.Length && s[i] == '.')
                {
                    i++;
                    while (i < s.Length && s[i] >= '0' && s[i] <= '9') { if (fd < 15) { frac = frac * 10 + (s[i] - '0'); fd++; } i++; }
                }
                if (digits > 17 || (i < s.Length && (s[i] == 'e' || s[i] == 'E')))
                {
                    if (i < s.Length && (s[i] == 'e' || s[i] == 'E'))
                    {
                        i++;
                        if (i < s.Length && (s[i] == '+' || s[i] == '-')) i++;
                        while (i < s.Length && s[i] >= '0' && s[i] <= '9') i++;
                    }
                    return double.Parse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture);
                }
                double v = whole + frac * TENTHS[fd];
                return neg ? -v : v;
            }
        }

        // ------------------------------------------------------------ reading helpers

        public static double Num(Dictionary<string, object> d, string key, double fallback = 0)
            => d != null && d.TryGetValue(key, out var v) && v is double n ? n : fallback;

        public static string Str(Dictionary<string, object> d, string key, string fallback = null)
            => d != null && d.TryGetValue(key, out var v) && v is string t ? t : fallback;

        public static bool Bool(Dictionary<string, object> d, string key)
            => d != null && d.TryGetValue(key, out var v) && (v is bool b ? b : v is double n && n != 0);

        public static List<object> List(Dictionary<string, object> d, string key)
            => d != null && d.TryGetValue(key, out var v) ? v as List<object> : null;

        public static Dictionary<string, object> Obj(Dictionary<string, object> d, string key)
            => d != null && d.TryGetValue(key, out var v) ? v as Dictionary<string, object> : null;

        /// <summary>Element i of a number row, 0 when missing or not a number.</summary>
        public static double At(List<object> row, int i) => row != null && i < row.Count && row[i] is double n ? n : 0;
    }

    /// <summary>Writes one flat JSON object: <c>new JsonWriter().Str("t","in").Num("q",4).End()</c>.</summary>
    public sealed class JsonWriter
    {
        readonly StringBuilder sb = new StringBuilder(96);
        bool first = true;

        public JsonWriter() { sb.Append('{'); }

        JsonWriter Key(string k)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append('"').Append(k).Append("\":");
            return this;
        }

        public JsonWriter Str(string k, string v)
        {
            Key(k);
            if (v == null) { sb.Append("null"); return this; }
            sb.Append('"');
            foreach (char c in v)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
            return this;
        }

        public JsonWriter Num(string k, int v) { Key(k).sb.Append(v.ToString(CultureInfo.InvariantCulture)); return this; }

        /// <summary>A float rounded to 3 decimals: thumb directions need no more and messages stay small.</summary>
        public JsonWriter Num(string k, float v)
        {
            if (float.IsNaN(v) || float.IsInfinity(v)) v = 0;
            Key(k).sb.Append(Math.Round(v, 3).ToString("0.###", CultureInfo.InvariantCulture));
            return this;
        }

        public JsonWriter Bit(string k, bool on) => Num(k, on ? 1 : 0);

        public string End() { sb.Append('}'); return sb.ToString(); }
    }
}
