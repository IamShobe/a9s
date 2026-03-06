#!/bin/bash
# Create a PR from current branch to master
# Usage: ./scripts/create-pr.sh [title] [body]

set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
TITLE="${1:-$(git log -1 --pretty=%B | head -1)}"

if [ "$BRANCH" = "master" ]; then
  echo "Error: Cannot create PR from master branch"
  exit 1
fi

echo "Creating PR from $BRANCH to master..."
echo "Title: $TITLE"

# Push branch if not yet on remote
if ! git ls-remote --exit-code origin "$BRANCH" &>/dev/null; then
  echo "Pushing $BRANCH to origin..."
  git push -u origin "$BRANCH"
fi

# Read body from second argument, stdin, or fall back to commit list
if [ -n "${2:-}" ]; then
  BODY="$2"
elif [ ! -t 0 ]; then
  BODY=$(cat)
else
  BODY=$(git log --reverse --pretty='- %s' origin/master..HEAD)
fi

gh pr create --title "$TITLE" --body "$BODY" --base master

echo "✓ PR created successfully"
