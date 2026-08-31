#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /Users/nca/weavehacks/clip
exec npm run dev -- --port "$1" --strictPort --host
