#!/usr/bin/env bash
# Install the Saturday 09:00 Cairo-time launchd job for repo-triage-burst.
# launchd coalesces missed fires (Mac asleep at 09:00 -> runs on wake).
set -euo pipefail

PLIST_LABEL="com.adham.cqd.triage"
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/repo_triage.py"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${SCRIPT_PATH}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>6</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/cqd-triage.log</string>
  <key>StandardErrorPath</key><string>/tmp/cqd-triage.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"
echo "Installed: ${PLIST_PATH} (Saturdays 09:00, runs on wake if missed)"

# Optional: always-on Telegram command daemon (/status /prs /security ...).
# KeepAlive restarts it if it crashes; answers queued commands on Mac wake.
BOT_PLIST="$HOME/Library/LaunchAgents/com.adham.cqd.triagebot.plist"
if [ "${1:-}" = "--with-daemon" ]; then
  cat > "$BOT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.adham.cqd.triagebot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${SCRIPT_PATH}</string>
    <string>--serve</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/cqd-triagebot.log</string>
  <key>StandardErrorPath</key><string>/tmp/cqd-triagebot.err.log</string>
</dict>
</plist>
EOF
  launchctl unload "$BOT_PLIST" 2>/dev/null || true
  launchctl load "$BOT_PLIST"
  echo "Installed daemon: ${BOT_PLIST} (answers Telegram commands whenever the Mac is awake)"
fi
echo "Logs: /tmp/cqd-triage.{log,err.log} · Uninstall: launchctl unload <plist>"
