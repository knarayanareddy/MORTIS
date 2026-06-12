#!/usr/bin/env bash
# §12.3: SBOM generation in CycloneDX JSON format
set -euo pipefail

VERSION=$(cargo metadata --format-version=1 --no-deps | jq -r '.packages[0].version')
OUTPUT="releases/${VERSION}/mortis.cdx.json"

mkdir -p "releases/${VERSION}"

echo "Generating SBOM for MORTIS v${VERSION}..."

# Generate CycloneDX SBOM
cargo cyclonedx -o "$OUTPUT" 2>/dev/null || {
    echo "cargo-cyclonedx not installed. Installing..."
    cargo install cargo-cyclonedx
    cargo cyclonedx -o "$OUTPUT"
}

echo "✅ SBOM written to ${OUTPUT}"
echo "SHA-256: $(sha256sum "$OUTPUT" | cut -d' ' -f1)"
