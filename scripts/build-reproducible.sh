#!/usr/bin/env bash
# §12.1: Reproducible build verification
# Two independent builds must produce identical SHA-256 hashes.
set -euo pipefail

export SOURCE_DATE_EPOCH=0

echo "=== Build 1 ==="
cargo build --release 2>&1
cp target/release/mortis /tmp/mortis-build-1

echo "=== Build 2 ==="
cargo clean
cargo build --release 2>&1
cp target/release/mortis /tmp/mortis-build-2

echo "=== Hash comparison ==="
HASH1=$(sha256sum /tmp/mortis-build-1 | cut -d' ' -f1)
HASH2=$(sha256sum /tmp/mortis-build-2 | cut -d' ' -f1)

echo "Build 1: $HASH1"
echo "Build 2: $HASH2"

if [ "$HASH1" = "$HASH2" ]; then
    echo "✅ Reproducible build VERIFIED"
    exit 0
else
    echo "❌ Reproducible build FAILED"
    exit 1
fi
