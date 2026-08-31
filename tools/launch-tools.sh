#!/usr/bin/env bash
# Launch the local tools so they produce real, streamable logs.
set -u
DIR="/Users/nca/weavehacks/clip/tools"
LOGS="/Users/nca/weavehacks/clip/.toollogs"
mkdir -p "$LOGS"
ARCH="$(uname -m)"

# 1) Redis on 6380 (docker) — real server, logs via `docker logs`
if docker ps --format '{{.Names}}' | grep -q '^clip-redis$'; then
  echo "redis: already running"
else
  docker rm -f clip-redis >/dev/null 2>&1
  if docker run -d --name clip-redis -p 6380:6379 redis:7 >/dev/null 2>&1; then
    echo "redis: launched (clip-redis :6380)"
  else
    echo "redis: FAILED"
  fi
fi

# 2) frida-server on 27042 — download the build matching the installed py-frida
FRIDA_VER="17.10.1"
case "$ARCH" in
  arm64) FA="macos-arm64" ;;
  *)     FA="macos-x86_64" ;;
esac
if [ ! -x "$DIR/frida-server" ]; then
  echo "frida: downloading frida-server $FRIDA_VER $FA"
  curl -sL "https://github.com/frida/frida/releases/download/${FRIDA_VER}/frida-server-${FRIDA_VER}-${FA}.xz" -o /tmp/frida-server.xz \
    && unxz -f /tmp/frida-server.xz \
    && mv /tmp/frida-server "$DIR/frida-server" \
    && chmod +x "$DIR/frida-server"
fi
if lsof -nP -iTCP:27042 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "frida: already listening :27042"
elif [ -x "$DIR/frida-server" ]; then
  nohup "$DIR/frida-server" -l 127.0.0.1:27042 --verbose >"$LOGS/frida.log" 2>&1 &
  disown
  echo "frida: launched (:27042)"
else
  echo "frida: binary unavailable"
fi

# 3) Camoufox — a persistent headless session that logs each fetch
if pgrep -f "tools/camoufox_run.py" >/dev/null 2>&1; then
  echo "camoufox: already running"
else
  nohup /Users/nca/bastion-web/.venv/bin/python "$DIR/camoufox_run.py" >"$LOGS/camoufox.log" 2>&1 &
  disown
  echo "camoufox: launched"
fi

echo "done."
