#!/bin/sh
# Bind-mounted volumes arrive owned by root; give them to the app user, then drop privileges.
set -e
chown -R app:app /app/data 2>/dev/null || true
exec su-exec app node server.js
