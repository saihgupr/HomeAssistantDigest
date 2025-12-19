#!/bin/bash

# Run in background so shell returns immediately
(ssh root@192.168.1.4 'sh -c "ha addons reload && ha addons rebuild local_ha-digest"' && sleep 1 && osascript -e 'tell application "Keyboard Maestro Engine" to do script "68608BC3-95F1-4EDB-BC75-7DD3A0B66959"') >/dev/null 2>&1 &
