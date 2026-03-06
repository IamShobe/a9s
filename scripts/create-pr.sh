#!/bin/bash
# Create a PR from current branch to master.
# Automatically applies GitHub labels based on conventional commit prefix:
#   feat:/feature:  → minor + enhancement  (minor version bump)
#   fix:/bugfix:    → patch + fix      (patch version bump)
#   chore:/docs:    → patch + chore    (patch version bump)
#   BREAKING/major: → major + enhancement  (major version bump)
#
# Usage: ./scripts/create-pr.sh [title] [body]

set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
TITLE="${1:-$(git log -1 --pretty=%B | head -1)}"

if [ "$BRANCH" = "master" ]; then
  echo "Error: Cannot create PR from master branch"
  exit 1
fi

# Determine labels from title prefix (conventional commits → release-drafter labels)
LABELS=""
LOWER_TITLE=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]')

if echo "$TITLE" | grep -qiE "^BREAKING[[:space:]CHANGE!]|^major:"; then
  LABELS="major,enhancement"
elif echo "$LOWER_TITLE" | grep -qE "^feat(ure)?(\(.+\))?!?:"; then
  LABELS="minor,enhancement"
elif echo "$LOWER_TITLE" | grep -qE "^fix(up)?(\(.+\))?!?:|^bugfix:"; then
  LABELS="patch,fix"
elif echo "$LOWER_TITLE" | grep -qE "^chore(\(.+\))?!?:|^docs(\(.+\))?!?:|^refactor(\(.+\))?!?:|^ci(\(.+\))?!?:"; then
  LABELS="patch,chore"
else
  LABELS="patch"
fi

echo "Creating PR from $BRANCH to master..."
echo "Title: $TITLE"
echo "Labels: $LABELS"

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

gh pr create --title "$TITLE" --body "$BODY" --base master --label "$LABELS"

echo "✓ PR created successfully"
