#!/bin/bash
# config.sh — Configuration paths and constants for StaySuite-HospitalityOS network scripts
# This file is sourced by other scripts; do not execute directly.

# Resolve the base directory of the network scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Network configuration file (Debian /etc/network/interfaces)
INTERFACES_FILE="/etc/network/interfaces"

# Logging
NETWORK_LOG_DIR="/var/log/staysuite"
NETWORK_LOG_FILE="${NETWORK_LOG_DIR}/network.log"

# Marker used in /etc/network/interfaces to identify managed blocks
MANAGED_MARKER="# STAYSUITE_MANAGED"

# Role marker prefix
ROLE_MARKER="# STAYSUITE_ROLE"
PRIORITY_MARKER="# STAYSUITE_PRIORITY"

# Bonding module
BONDING_MODULE="bonding"

# Default values
DEFAULT_STP="off"
DEFAULT_FORWARD_DELAY=15
DEFAULT_MIIMON=100
DEFAULT_LACP_RATE="slow"
DEFAULT_VLAN_MTU=1500
MIN_MTU=576
MAX_MTU=9000
MIN_VLAN_ID=1
MAX_VLAN_ID=4094

# Multi-WAN routing table range
MULTIWAN_TABLE_START=101
MULTIWAN_TABLE_END=250

# Command timeout in seconds
CMD_TIMEOUT=30
