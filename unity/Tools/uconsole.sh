#!/bin/zsh
# Print the connected Unity Editor's console entries (default: errors), one per line.
# Usage: Tools/uconsole.sh [level=error] [tail=40]
cd "$(dirname "$0")/.."
~/.unity/bin/unity command --project-path "$PWD" --timeout 60 --format json console -- --tail ${2:-40} --level ${1:-error} 2>/dev/null | python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw[:2000]); sys.exit(0)
def find(o):
    if isinstance(o, dict):
        if "entries" in o: return o
        for v in o.values():
            r = find(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = find(v)
            if r: return r
    if isinstance(o, str) and o.strip().startswith("{"):
        try: return find(json.loads(o))
        except Exception: return None
    return None
c = find(d)
if not c: print(raw[:2000]); sys.exit(0)
for e in c.get("entries", []):
    print("-", (e.get("message") or "")[:600].replace("\n", " | "))
    st = e.get("stackTrace") or e.get("stack") or ""
    if st and e.get("type", e.get("level", "")) != "log": print("   ", st[:700].replace("\n", " <- "))
g = c.get("groundTruth", {})
print("compiling=%s failed=%s errors=%s warnings=%s" % (g.get("compiling"), g.get("compilationFailed"), g.get("consoleErrors"), g.get("consoleWarnings")))
'
