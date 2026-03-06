---
name: a9s-release
description: |
  Guides users through the complete npm package release workflow for @a9s/cli.
  Use this skill when the user wants to publish a new version, create a PR for release,
  merge a PR, or release a draft to npm. Also use it when they mention:
  - "I want to release" or "time to release"
  - "create a PR" (in a release context)
  - "merge this PR" or "is CI done?"
  - "release the draft"
  - "what's the release process?"
  - "publish a new version"

  The skill orchestrates the full workflow: branch → PR → CI → merge → draft → release,
  with helpful guidance at each step and confirmation before destructive actions.
compatibility: Requires gh (GitHub CLI) with authentication and git
---

# @a9s/cli Release Workflow Skill

This skill guides you through publishing new versions of @a9s/cli to npm.

## Quick Start

The release process has 4 main steps:

```
1. Create PR from your feature branch to master
2. Wait for CI checks to pass
3. Auto-merge the PR
4. Release the draft version to npm
```

Or run all steps at once with:
```bash
pnpm release:workflow <branch-name> [pr-title]
```

## Individual Release Tasks

### Task 1: Create a Pull Request

**Command:**
```bash
pnpm release:create-pr [title]
```

**What it does:**
- Creates a PR from your current branch to master
- Uses your latest commit message as the default title if you don't provide one
- Example: `pnpm release:create-pr "Add awesome feature"`

**Requirements:**
- You must be on a feature branch (not master)
- GitHub CLI (gh) must be authenticated: `gh auth login`

**Output:** PR URL and number

---

### Task 2: Wait for CI and Merge

**Command:**
```bash
pnpm release:merge-if-ci-passes <pr-number>
```

**What it does:**
- Watches the CI checks on your PR
- Waits until all checks pass
- Auto-merges with squash commit
- Shows real-time status updates

**Example:** `pnpm release:merge-if-ci-passes 42`

**Note:** The script aborts if:
- Any check fails
- Checks are still pending after timeout
- The PR is already closed

---

### Task 3: Release a Draft

**Command:**
```bash
pnpm release:draft
```

**What it does:**
- Finds the latest draft release
- Shows you the release notes
- Asks for confirmation before releasing
- Publishes to npm via GitHub Actions

**Output:** Release URL and npm package link

---

### Complete Workflow (All Steps)

**Command:**
```bash
pnpm release:workflow <branch-name> [pr-title]
```

**Example:**
```bash
pnpm release:workflow feat/new-feature "Add new feature"
pnpm release:workflow bugfix/issue-123
```

**What it does:**
1. Creates PR from your branch to master
2. Watches CI checks
3. Auto-merges when CI passes
4. Waits for Release Drafter to create draft
5. Shows release notes
6. Asks for confirmation
7. Releases to npm

This is the recommended way to do a full release end-to-end.

---

## How It Works Behind the Scenes

### Versioning (Automatic)

- **package.json** is kept at version `0.0.0` in the repo
- Version comes from **git tags** (e.g., `v1.0.3`)
- When you release, the CI workflow automatically:
  - Extracts version from the tag
  - Updates package.json
  - Builds and tests
  - Publishes to npm

This means: **no manual version bumping needed!**

### Release Workflow in GitHub

1. **You push a tag** (either manually or via draft release) → `v1.0.x`
2. **npm publish workflow** runs automatically:
   - Extracts version from tag
   - Runs typecheck, test, build
   - Publishes to npm registry
3. **Package appears on npm** at `@a9s/cli@1.0.x`

---

## Troubleshooting

### "PR creation failed"
- Make sure you're on a feature branch (not master)
- Check: `git rev-parse --abbrev-ref HEAD`
- Authenticate gh: `gh auth login`

### "CI is still running"
- The script waits for all checks to complete
- Check status in GitHub Actions tab
- Large TypeScript builds can take 30+ seconds

### "No draft release found"
- Release Drafter workflow may be delayed (usually 1-2 minutes after merge)
- Wait a minute and run `pnpm release:draft` again
- Check `.github/workflows/draft_release.yaml` status in Actions tab

### "npm publish failed"
- Check package.json name is `@a9s/cli`
- Verify the git tag format is `v<VERSION>` (e.g., `v1.0.3`)
- View npm package: `npm view @a9s/cli`

---

## Common Workflows

### I have a fix ready on my branch

```bash
# Full workflow - does everything
pnpm release:workflow feat/my-fix "Fix critical bug"

# Or step-by-step
pnpm release:create-pr "Fix critical bug"
# Now wait for your PR to be reviewed...
pnpm release:merge-if-ci-passes 42
# Wait for draft to appear (1-2 mins)
pnpm release:draft
```

### I just want to check if a specific PR's CI passed

```bash
pnpm release:merge-if-ci-passes 42
```

### I want to manually control each step

```bash
# Step 1: Create PR
pnpm release:create-pr

# Step 2: Watch GitHub for manual review, then
pnpm release:merge-if-ci-passes 42

# Step 3: When ready to release
pnpm release:draft
```

---

## Environment Requirements

Before using the release workflow, verify you have:

- Node.js 18+
- pnpm 10+
- Git
- GitHub CLI: `gh` with authentication

Check with:
```bash
node --version
pnpm --version
gh --version
gh auth status  # Should show your GitHub login
```

---

## More Information

See `RELEASE.md` in the repo root for:
- Detailed documentation
- Manual tag creation
- Manual npm publishing
- CI/CD configuration details
- Advanced troubleshooting
