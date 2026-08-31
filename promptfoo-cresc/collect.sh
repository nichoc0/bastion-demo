#!/bin/zsh
# Collect server-side stats per model
for m in "qwen2.5:7b-instruct" "llama3.1:8b" "llama3.2:3b"; do
  echo "=== $m ==="
  curl -s "http://localhost:8902/stats?attacker=promptfoo&model=$m"
  echo
done
