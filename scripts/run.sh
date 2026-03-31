#!/bin/bash
set -e

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
JAR=$(ls "$ROOT_DIR/apps/server/build/libs/"*.jar 2>/dev/null | head -1)
SERVER_PORT=${MY_PAG_PORT:-8080}
SERVER_ADDRESS=${MY_PAG_HOST:-0.0.0.0}

if [ -z "$JAR" ]; then
    echo "No JAR found. Run ./scripts/build.sh first."
    exit 1
fi

DB_DIR="$HOME/.my-pag"
mkdir -p "$DB_DIR"

echo "==> Starting my-pag server..."
echo "    JAR: $JAR"
echo "    DB:  $DB_DIR/my-pag.db"
echo "    Bind: $SERVER_ADDRESS:$SERVER_PORT"
echo "    Local: http://localhost:$SERVER_PORT"
if command -v hostname >/dev/null 2>&1; then
    LAN_IPS=$(hostname -I 2>/dev/null | xargs)
    if [ -n "$LAN_IPS" ]; then
        for ip in $LAN_IPS; do
            echo "    LAN:   http://$ip:$SERVER_PORT"
        done
    fi
fi
echo ""

MY_PAG_DB_PATH="$DB_DIR/my-pag.db" java -jar "$JAR" \
    --server.address="$SERVER_ADDRESS" \
    --server.port="$SERVER_PORT"
