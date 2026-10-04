#!/bin/zsh
# Render the running game (HUD included) to Screenshots/<name>.png.  Usage: Tools/shot.sh name [w] [h] [notch=false]
cd "$(dirname "$0")/.."
mkdir -p Screenshots
~/.unity/bin/unity command --project-path "$PWD" --timeout 60 eval "return Telfer.Game.Shots.Capture(\"$PWD/Screenshots/$1.png\", ${2:-1600}, ${3:-900}, ${4:-false});" 2>&1 | tail -1 | cut -c1-160
