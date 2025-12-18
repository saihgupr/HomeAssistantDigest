#!/usr/bin/env bash
set -e

# Read add-on options
CONFIG_PATH=/data/options.json

# Debug logging
echo "Checking environment..."
if command -v jq &> /dev/null; then
    echo "jq is installed"
else
    echo "ERROR: jq is NOT installed"
fi

if [ -f "$CONFIG_PATH" ]; then
    echo "Config file found at $CONFIG_PATH"
else
    echo "ERROR: Config file not found at $CONFIG_PATH"
fi

# Extract config
GEMINI_KEY=$(jq -r '.gemini_api_key // empty' $CONFIG_PATH)

if [ -n "$GEMINI_KEY" ] && [ "$GEMINI_KEY" != "null" ]; then
    echo "Gemini API Key found (length: ${#GEMINI_KEY})"
    export GEMINI_API_KEY="$GEMINI_KEY"
else
    echo "ERROR: Gemini API Key is missing or null in options.json"
fi

export DIGEST_TIME=$(jq -r '.digest_time' $CONFIG_PATH)
export NOTIFICATION_SERVICE=$(jq -r '.notification_service' $CONFIG_PATH)
export HISTORY_DAYS=$(jq -r '.history_days' $CONFIG_PATH)
export SNAPSHOT_INTERVAL_MINUTES=$(jq -r '.snapshot_interval_minutes' $CONFIG_PATH)

# Start the server
echo "Starting Home Assistant Digest..."
exec node server/index.js
