#!/bin/zsh
# Evaluate C# in the running editor and print the result.  Usage: Tools/ev.sh 'return 1+1;'
cd "$(dirname "$0")/.."
~/.unity/bin/unity command --project-path "$PWD" --timeout ${2:-30} --format json eval "$1" 2>&1 | python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw); r = d.get("data", d)
    def dig(o):
        if isinstance(o, dict):
            if "result" in o and ("success" in o or "diagnostics" in o): return o
            for v in o.values():
                x = dig(v)
                if x: return x
        if isinstance(o, list):
            for v in o:
                x = dig(v)
                if x: return x
        if isinstance(o, str) and o.strip().startswith("{"):
            try: return dig(json.loads(o))
            except Exception: return None
    x = dig(d)
    if x: print(x.get("result"), x.get("diagnostics") or "", x.get("error") or "")
    else: print(raw[:1500])
except Exception: print(raw[:1500])
'
