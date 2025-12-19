#!/usr/bin/with-contenv bash
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

export DATA_DIR=/data
export DIGEST_TIME=$(jq -r '.digest_time' $CONFIG_PATH)
export WEEKLY_DIGEST_DAY=$(jq -r '.weekly_digest_day' $CONFIG_PATH)
export NOTIFICATION_SERVICE=$(jq -r '.notification_service' $CONFIG_PATH)
export HISTORY_DAYS=$(jq -r '.history_days' $CONFIG_PATH)
export SNAPSHOT_INTERVAL_MINUTES=$(jq -r '.snapshot_interval_minutes' $CONFIG_PATH)

# Check Supervisor Token
if [ -n "$SUPERVISOR_TOKEN" ]; then
    echo "Supervisor Token found (length: ${#SUPERVISOR_TOKEN})"
else
    echo "WARNING: Supervisor Token NOT found in environment!"
fi

# Check Supervisor Token
if [ -n "$SUPERVISOR_TOKEN" ]; then
    echo "Supervisor Token found (length: ${#SUPERVISOR_TOKEN})"
else
    echo "WARNING: Supervisor Token NOT found in environment!"
    echo "Available Environment Variables:"
    env | cut -d= -f1 | sort
fi

# Persistence Check
if [ -d "/data" ]; then
    echo "Persistence: /data directory exists"
else
    echo "WARNING: /data directory NOT found!"
fi

# Start the server
echo "Starting Home Assistant Digest..."
exec node server/index.js
