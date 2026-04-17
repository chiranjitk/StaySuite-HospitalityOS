#!/bin/bash
# StaySuite HospitalityOS — Update & Clean Restart Script
# Run this after `git pull` to clear Next.js cache and restart all services
#
# Usage: bash scripts/update-and-restart.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  StaySuite HospitalityOS — Update & Clean Restart    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

cd "$PROJECT_ROOT"

# 1. Pull latest code
echo "📦 [1/4] Pulling latest code..."
git pull
echo "   Done."
echo ""

# 2. Install dependencies (if package.json changed)
echo "📥 [2/4] Checking dependencies..."
if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package.json"; then
  echo "   package.json changed — running bun install..."
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  echo "   No dependency changes."
fi
echo ""

# 3. Clear Next.js build cache (fixes stale routes after git pull)
echo "🧹 [3/4] Clearing Next.js cache..."
if [ -d ".next" ]; then
  rm -rf .next
  echo "   Removed .next/"
else
  echo "   .next/ not found (already clean)."
fi
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "   Removed node_modules/.cache/"
fi
echo "   Cache cleared."
echo ""

# 4. Restart all PM2 services
echo "🔄 [4/4] Restarting PM2 services..."
if command -v pm2 &>/dev/null; then
  pm2 restart all
  echo ""
  echo "✅ All services restarted. Run 'pm2 logs' to monitor."
else
  echo "⚠️  PM2 not found. Start services manually:"
  echo "   bun run dev          # Main Next.js app (port 3000)"
  echo "   cd mini-services/* && bun --hot index.ts  # Mini services"
fi

echo ""
echo "──────────────────────────────────────────────────────"
echo "  StaySuite should be available at:"
echo "  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo "──────────────────────────────────────────────────────"
