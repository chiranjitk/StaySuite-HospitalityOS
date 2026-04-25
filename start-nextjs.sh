#!/usr/bin/env bash
# =============================================================================
# StaySuite HospitalityOS - Next.js Standalone Server Wrapper
# =============================================================================
# On Rocky Linux 10, the OS sets HOSTNAME to the machine hostname which may
# DNS-resolve to an IPv6 link-local address (fe80::...). Node.js
# server.listen() with a link-local IPv6 address fails with EINVAL because
# link-local IPv6 requires a zone/scope ID (e.g., fe80::1%eth0).
#
# The Next.js standalone server (.next/standalone/server.js) reads
# process.env.HOSTNAME to determine the listen address. It does NOT parse
# --hostname CLI args. PM2 cannot reliably override the system HOSTNAME
# environment variable.
#
# This wrapper is the ONLY reliable fix: it explicitly sets HOSTNAME=0.0.0.0
# before launching the standalone server, ensuring it listens on all IPv4
# interfaces.
#
# Usage:
#   chmod +x start-nextjs.sh
#   ./start-nextjs.sh
#
# With PM2 (see ecosystem.config.js):
#   pm2 start ecosystem.config.js
# =============================================================================

set -e

# Force listen address to all IPv4 interfaces
export HOSTNAME='0.0.0.0'

# Determine the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The standalone server must be run from the project root (DEPLOY_DIR)
# because it uses relative paths for .next/standalone/ assets
cd "$SCRIPT_DIR"

# exec replaces this bash process with node — PM2 keeps tracking the same PID
exec node .next/standalone/server.js "$@"
