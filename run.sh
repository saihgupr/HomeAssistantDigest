#!/usr/bin/env bash
set -e

# Read add-on options
CONFIG_PATH=/data/options.json

export GEMINI_API_KEY=$(jq -r '.gemini_api_key' $CONFIG_PATH)
export DIGEST_TIME=$(jq -r '.digest_time' $CONFIG_PATH)
export NOTIFICATION_SERVICE=$(jq -r '.notification_service' $CONFIG_PATH)
export HISTORY_DAYS=$(jq -r '.history_days' $CONFIG_PATH)
export SNAPSHOT_INTERVAL_MINUTES=$(jq -r '.snapshot_interval_minutes' $CONFIG_PATH)

# Supervisor token for HA API access
export SUPERVISOR_TOKEN=$SUPERVISOR_TOKEN

# Data directory for persistence
export DATA_DIR=/data

# Start the server
echo "Starting Home Assistant Digest..."
exec node server/index.js
