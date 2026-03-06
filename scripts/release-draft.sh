#!/bin/bash
# Find the latest draft release and release it
# Usage: ./scripts/release-draft.sh

set -e

echo "Finding latest draft release..."

# Get the latest draft release
DRAFT=$(gh release list --exclude-drafts=false --json tagName,isDraft -q '.[] | select(.isDraft == true) | .tagName' | head -1)

if [ -z "$DRAFT" ]; then
  echo "✗ No draft releases found"
  exit 1
fi

echo "Found draft: $DRAFT"

# Show release notes
echo ""
echo "Release notes:"
echo "---"
gh release view "$DRAFT" --json body -q '.body'
echo "---"
echo ""

read -p "Release $DRAFT? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

echo "Releasing $DRAFT..."
gh release edit "$DRAFT" --draft=false

echo "✓ Released successfully: $DRAFT"
