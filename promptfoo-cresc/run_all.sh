#!/bin/zsh
# promptfoo crescendo vs MailBot, 3 models, SEQUENTIAL.
# -j 1 is REQUIRED: concurrent conversations on the same (attacker,model) key corrupt
# the server's conversation-level scoring (interleaved turns merge into one conversation).
# reset is scoped to attacker=promptfoo and done ONCE (a scoped reset clears all that
# attacker's models, so resetting per-model would wipe prior models' results; never reset PyRIT).
cd /Users/nca/weavehacks/clip/promptfoo-cresc
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export PROMPTFOO_DISABLE_TELEMETRY=1
export PROMPTFOO_DISABLE_UPDATE=1
export PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION=true
export OPENAI_API_KEY=sk-local
RESULTS=artifacts/results.txt
: > $RESULTS
curl -s -X POST "http://127.0.0.1:8902/reset?attacker=promptfoo" >/dev/null
models=("qwen2.5:7b-instruct" "llama3.1:8b" "llama3.2:3b")
files=("cfg_qwen2_5_7b_instruct.json" "cfg_llama3_1_8b.json" "cfg_llama3_2_3b.json")
for i in 1 2 3; do
  m=$models[$i]; f=$files[$i]
  tag=$(echo $m | tr ':/.' '_')
  echo "MODEL_START $m $(date +%T)"
  timeout 2400 npx promptfoo@latest redteam run -c $f -o artifacts/out_$tag.json --force -j 1 > artifacts/log_$tag.txt 2>&1
  ec=$?
  stats=$(curl -s "http://127.0.0.1:8902/stats?attacker=promptfoo&model=$m")
  echo "MODEL_DONE $m exit=$ec $(date +%T)"
  echo "=== $m (exit=$ec) ===" >> $RESULTS
  echo "after:  $stats" >> $RESULTS
  echo "STATS $m :: $stats"
done
echo "ALL_DONE $(date +%T)"
