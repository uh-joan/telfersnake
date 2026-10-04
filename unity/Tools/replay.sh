#!/bin/zsh
# Stop play mode, pick up script/asset changes, report compile errors, and play again.
# Usage: Tools/replay.sh [seconds-to-wait-after-play=12]
cd "$(dirname "$0")/.."
U=~/.unity/bin/unity; P=(--project-path "$PWD")
$U command $P --timeout 60 eval 'UnityEditor.EditorApplication.isPlaying = false; return "stopped";' >/dev/null 2>&1
sleep 2
$U command $P --timeout 120 eval 'UnityEditor.AssetDatabase.Refresh(); return "refreshed";' >/dev/null 2>&1
sleep 3
out=$($U recompile $P 2>&1 | grep -E "error|Error" | head -20)
if [ -n "$out" ]; then echo "$out"; exit 1; fi
for i in 1 2 3 4 5 6 7 8 9 10; do
  r=$($U command $P --timeout 20 eval 'return UnityEditor.EditorApplication.isCompiling ? "busy" : "idle";' 2>&1 | tail -1)
  echo "$r" | grep -q idle && break; sleep 3
done
$U command $P --timeout 30 clear_console >/dev/null 2>&1
$U command $P --timeout 60 eval 'UnityEditor.SceneManagement.EditorSceneManager.OpenScene("Assets/Telfersnake/Scenes/Main.unity"); UnityEditor.EditorApplication.isPlaying = true; return "playing";' 2>&1 | tail -1 | cut -c1-80
sleep ${1:-12}
Tools/uconsole.sh warn 15
