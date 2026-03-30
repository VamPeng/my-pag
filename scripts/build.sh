#!/bin/bash
set -e

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
WEB_DIR="$ROOT_DIR/apps/web"
SERVER_DIR="$ROOT_DIR/apps/server"
STATIC_DIR="$SERVER_DIR/src/main/resources/static"

echo "==> Building frontend..."
cd "$WEB_DIR"
VITE_API_BASE_URL="" npm run build

echo "==> Copying frontend into server static resources..."
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r "$WEB_DIR/dist/." "$STATIC_DIR/"

echo "==> Building server JAR..."
cd "$SERVER_DIR"
./gradlew bootJar

JAR=$(ls "$SERVER_DIR/build/libs/"*.jar | head -1)
echo ""
echo "Build complete!"
echo "JAR: $JAR"
echo ""
echo "Run with: ./scripts/run.sh"
