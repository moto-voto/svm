#!/usr/bin/env bash
# Remote install script for SVM.
# Extracted from the deploy tarball (see scripts/deploy.js) and executed on
# the server. Replaces web files, installs the app bundle, fixes ownership,
# restarts services, then cleans up its own staging directory.
set -euo pipefail

# Staging dir the tarball was extracted into (passed by deploy.js).
STAGE="${1:-/tmp/svm-deploy}"
WEB="/var/www/svm"
APP="/opt/svm"

echo "==> Installing artifacts..."
mkdir -p "$WEB" "$APP"

echo "==> Replacing web files..."
rm -rf "$WEB"/*
cp -r "$STAGE/public/." "$WEB/"

echo "==> Installing app bundle..."
cp "$STAGE/svm.js" "$APP/svm.js"

echo "==> Fixing ownership and permissions..."
chown -R root:svm "$WEB"
chmod -R 755 "$WEB"
chown -R svm:svm "$APP"

echo "==> Restarting services..."
sv restart svm
sv restart nginx

echo "==> Cleaning up staging dir..."
rm -rf "$STAGE"

echo "==> Install complete."