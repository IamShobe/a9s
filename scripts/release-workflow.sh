#!/bin/bash
# Complete release workflow orchestration
# Creates PR → waits for CI → merges → waits for draft → releases
# Usage: ./scripts/release-workflow.sh [branch-name] [pr-title]

set -e

BRANCH="${1:?Please provide branch name. Usage: ./scripts/release-workflow.sh <branch-name> [pr-title]}"
TITLE="${2:-$(git log -1 --pretty=%B | head -1)}"

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  echo "Error: Not on branch $BRANCH"
  exit 1
fi

echo "🚀 Starting release workflow..."
echo ""

# Step 1: Create PR
echo "📝 Step 1/4: Creating pull request..."
PR_URL=$(gh pr create --title "$TITLE" --base master 2>&1 | grep "github.com")
PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
echo "✓ PR #$PR_NUM created"
echo ""

# Step 2: Wait for CI and merge
echo "🔄 Step 2/4: Waiting for CI checks..."
gh pr checks "$PR_NUM" --watch > /dev/null 2>&1

echo "✓ CI passed"
echo "Merging PR #$PR_NUM..."
gh pr merge "$PR_NUM" --squash > /dev/null 2>&1
echo "✓ PR merged"
echo ""

# Step 3: Wait for draft release
echo "⏳ Step 3/4: Waiting for draft release..."
for i in {1..30}; do
  DRAFT=$(gh release list --exclude-drafts=false --json tagName,isDraft -q '.[] | select(.isDraft == true) | .tagName' | head -1)
  if [ -n "$DRAFT" ]; then
    echo "✓ Draft found: $DRAFT"
    break
  fi
  if [ $i -lt 30 ]; then
    echo "  Waiting... ($i/30)"
    sleep 2
  fi
done

if [ -z "$DRAFT" ]; then
  echo "✗ No draft release found after waiting"
  exit 1
fi
echo ""

# Step 4: Release draft
echo "🎉 Step 4/4: Releasing draft..."
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

gh release edit "$DRAFT" --draft=false > /dev/null 2>&1
echo "✓ Released: $DRAFT"
echo ""
echo "✅ Release workflow complete!"
echo "📦 View at: https://github.com/IamShobe/a9s/releases/tag/$DRAFT"
