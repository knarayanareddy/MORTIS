#!/usr/bin/env bash
# §12.2: Binary signing with Sigstore/cosign (keyless OIDC-bound)
set -euo pipefail

VERSION=$(cargo metadata --format-version=1 --no-deps | jq -r '.packages[0].version')
BINARY="target/release/mortis"
BUNDLE="releases/${VERSION}/mortis.bundle"

mkdir -p "releases/${VERSION}"

if ! command -v cosign &> /dev/null; then
    echo "cosign not found. Install from https://docs.sigstore.dev/cosign/installation/"
    exit 1
fi

echo "=== Signing MORTIS v${VERSION} ==="

# Keyless sign (requires OIDC identity in CI)
cosign sign-blob \
    --bundle "$BUNDLE" \
    --yes \
    "$BINARY"

echo "✅ Binary signed"
echo "Bundle: ${BUNDLE}"
echo ""
echo "To verify:"
echo "  cosign verify-blob --bundle ${BUNDLE} ${BINARY}"
