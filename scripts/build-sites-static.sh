#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$project_root"
hugo --minify --cleanDestinationDir

if test -d "$project_root/dist"; then
  rm -r "$project_root/dist"
fi

mkdir -p "$project_root/dist/client" "$project_root/dist/server"
cp -R "$project_root/public"/. "$project_root/dist/client"/
cp "$project_root/sites/worker.js" "$project_root/dist/server/index.js"
