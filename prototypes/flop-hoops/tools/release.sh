#!/usr/bin/env bash
# PROTOTYPE - NOT FOR PRODUCTION
# Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
# Date: 2026-11-18
# Build the release: dist/ (what a player gets) and flop-hoops-<version>-web.zip, from the game's folder.
#   bash prototypes/flop-hoops/tools/release.sh
# Steps: the studio's one-shot-share.sh makes dist/ (no brief, no evidence); this takes out what a player does not need
# (the benchmark tools, the provenance record); the zip puts index.html at its top (what itch.io and any web host want).
# dist/ and the zip are build output and are not committed.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"; GAME="$(dirname "$HERE")"; ROOT="$(cd "$GAME/../.." && pwd)"
VER="$(sed -n "s/^const VERSION = '\([0-9.]*\)'.*/\1/p" "$GAME/index.html" | head -1)"
[ -n "$VER" ] || { echo "release: no VERSION in index.html" >&2; exit 1; }
rm -f "$GAME"/flop-hoops-*-web.zip   # (an old zip in the folder would be copied into dist/)
bash "$ROOT/.claude/scripts/one-shot-share.sh" "prototypes/$(basename "$GAME")" --root "$ROOT" >/dev/null
rm -rf "$GAME/dist/tools" "$GAME/dist/assets/provenance.yaml"
OUT="$GAME/flop-hoops-$VER-web.zip"; rm -f "$OUT"
( cd "$GAME/dist" && python3 - "$OUT" <<'PY'
import sys, os, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk('.'):
        for f in sorted(fs): z.write(os.path.join(d, f), os.path.relpath(os.path.join(d, f), '.'))
PY
)
echo "version  $VER"
echo "dist     $GAME/dist ($(find "$GAME/dist" -type f | wc -l) files, $(du -sk "$GAME/dist" | cut -f1) KB)"
echo "zip      $OUT ($(wc -c < "$OUT") bytes)"
