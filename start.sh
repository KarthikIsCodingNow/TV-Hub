#!/bin/bash
# ==============================================================================
# TV-HUB // Startup Script for Laptop
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "   TV-HUB [BAUHAUS EDITION]"
echo "   Form Follows Function • Android TV Remote & Cast"
echo "========================================================"

# Check if node is installed
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Please install Node.js (v18+) to run TV-Hub."
  exit 1
fi

# Check if adb is installed
if ! command -v adb >/dev/null 2>&1 && [ ! -f "/opt/homebrew/bin/adb" ]; then
  echo "Warning: ADB was not found in standard PATH."
  echo "Please install Android platform-tools (brew install android-platform-tools)."
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --production
fi

# Open browser automatically on macOS
(sleep 1.5 && open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || true) &

# Start server
node server.js

