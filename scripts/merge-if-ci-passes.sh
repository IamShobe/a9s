#!/bin/bash
# Wait for CI to pass on a PR and merge if successful
# Usage: ./scripts/merge-if-ci-passes.sh [pr-number]

set -e

PR="${1:?Please provide PR number. Usage: ./scripts/merge-if-ci-passes.sh <pr-number>}"

echo "Watching PR #$PR for CI completion..."

# Wait for checks to complete
gh pr checks "$PR" --watch

echo ""
echo "Checking final status..."

# Get the status
STATUS=$(gh pr checks "$PR" --json state -q '.[] | select(.state != null) | .state' | sort | uniq)

if echo "$STATUS" | grep -q "FAILURE\|NEUTRAL"; then
  echo "✗ CI failed. Not merging."
  exit 1
fi

if echo "$STATUS" | grep -q "PENDING\|QUEUED"; then
  echo "✗ CI still pending. Not merging."
  exit 1
fi

echo "✓ CI passed. Merging PR #$PR..."
gh pr merge "$PR" --squash

echo "✓ PR merged successfully"
