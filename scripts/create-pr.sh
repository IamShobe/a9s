#!/bin/bash
# Create a PR from current branch to master
# Usage: ./scripts/create-pr.sh [title] [body]

set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
TITLE="${1:-$(git log -1 --pretty=%B | head -1)}"
BODY="${2:-}"

if [ "$BRANCH" = "master" ]; then
  echo "Error: Cannot create PR from master branch"
  exit 1
fi

echo "Creating PR from $BRANCH to master..."
echo "Title: $TITLE"

if [ -z "$BODY" ]; then
  gh pr create --title "$TITLE" --base master
else
  gh pr create --title "$TITLE" --body "$BODY" --base master
fi

echo "✓ PR created successfully"
