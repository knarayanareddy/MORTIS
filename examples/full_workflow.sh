#!/bin/bash
# MORTIS Full Workflow Example
# This script demonstrates the complete MORTIS workflow

set -e

echo "=== MORTIS Workflow Demo ==="
echo ""

# Step 1: Initialize configuration
echo "1. Initializing MORTIS configuration..."
echo "   (In production, you would enter a secure passphrase)"
export MORTIS_PASSPHRASE="demo_passphrase_123"
mortis config init --passphrase-env MORTIS_PASSPHRASE
echo ""

# Step 2: Add assets to inventory
echo "2. Adding assets to inventory..."

# Add a sensitive file
mortis inventory add \
    --type local_file \
    --path /tmp/mortis_demo/secret.txt \
    --label "Secret Document" \
    --priority 100

# Add a directory
mortis inventory add \
    --type local_dir \
    --path /tmp/mortis_demo/sensitive_data/ \
    --label "Sensitive Data Directory" \
    --priority 90

# Add a browser profile
mortis inventory add \
    --type browser_profile \
    --path ~/.config/google-chrome/Default \
    --label "Chrome Profile" \
    --priority 80

# Add a cloud account
mortis inventory add \
    --type cloud_account \
    --path "https://accounts.google.com" \
    --label "Google Account" \
    --service-id google_account \
    --priority 70

echo ""

# Step 3: List inventory
echo "3. Current inventory:"
mortis inventory list --format table
echo ""

# Step 4: Create test files
echo "4. Creating test files..."
mkdir -p /tmp/mortis_demo/sensitive_data
echo "TOP SECRET DATA - Must be destroyed!" > /tmp/mortis_demo/secret.txt
echo "Financial records for Q4 2024" > /tmp/mortis_demo/sensitive_data/finance.txt
echo "Personal credentials" > /tmp/mortis_demo/sensitive_data/credentials.txt
echo "   Created test files in /tmp/mortis_demo/"
echo ""

# Step 5: Run in dry-run mode first
echo "5. Running plan in DRY-RUN mode (no actual destruction)..."
mortis run --plan examples/emergency_wipe.toml --dry-run
echo ""

# Step 6: Inspect the dry-run receipt
echo "6. Last receipt:"
mortis receipt list --last 1
echo ""

# Step 7: Run live (uncomment to execute)
# echo "7. Running plan LIVE..."
# mortis run --plan examples/emergency_wipe.toml
# echo ""

# Step 8: Verify receipt
# echo "8. Verifying receipt..."
# RECEIPT_FILE=$(ls -t ~/.mortis/receipts/*.receipt.json 2>/dev/null | head -1)
# if [ -n "$RECEIPT_FILE" ]; then
#     mortis receipt verify --receipt "$RECEIPT_FILE"
# fi
# echo ""

echo "=== Demo Complete ==="
echo ""
echo "To run the plan live (will destroy files!):"
echo "  mortis run --plan examples/emergency_wipe.toml"
echo ""
echo "To verify a receipt:"
echo "  mortis receipt verify --receipt ~/.mortis/receipts/<run_id>.receipt.json"
