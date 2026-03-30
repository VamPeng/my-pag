#!/bin/bash
set -e

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
JAR=$(ls "$ROOT_DIR/apps/server/build/libs/"*.jar 2>/dev/null | head -1)

if [ -z "$JAR" ]; then
    echo "No JAR found. Run ./scripts/build.sh first."
    exit 1
fi

DB_DIR="$HOME/.my-pag"
mkdir -p "$DB_DIR"

echo "==> Starting my-pag server..."
echo "    JAR: $JAR"
echo "    DB:  $DB_DIR/my-pag.db"
echo "    URL: http://localhost:8080"
echo ""

MY_PAG_DB_PATH="$DB_DIR/my-pag.db" java -jar "$JAR"
