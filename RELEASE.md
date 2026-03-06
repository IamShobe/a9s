# Release Workflow Guide

This document describes the automated release workflow for `@a9s/cli`.

## Overview

The release process is fully automated using git tags and GitHub Actions:

1. Create a feature branch and make changes
2. Create a PR to master
3. CI validates the changes
4. Merge the PR
5. Release Drafter creates a draft release
6. Release the draft to npm

Version is automatically derived from the git tag - no manual version bumping needed.

## Release Skills

### 1. Create PR

Create a pull request from your current branch to master.

```bash
pnpm release:create-pr [title] [body]
```

**Arguments:**
- `title` (optional): PR title. Defaults to latest commit message
- `body` (optional): PR description

**Example:**
```bash
pnpm release:create-pr "Add new feature"
pnpm release:create-pr
```

### 2. Reconcile CI & Merge

Wait for CI checks to pass on a PR, then automatically merge it if successful.

```bash
pnpm release:merge-if-ci-passes <pr-number>
```

**Arguments:**
- `pr-number` (required): Pull request number

**Example:**
```bash
pnpm release:merge-if-ci-passes 42
```

The script will:
- Watch CI checks until they complete
- Abort if CI fails
- Auto-merge with squash if all checks pass

### 3. Release Draft

Find the latest draft release and release it to npm.

```bash
pnpm release:draft
```

The script will:
- Find the latest draft release
- Display the release notes
- Ask for confirmation before releasing
- Trigger npm publish workflow via GitHub Actions

## Complete Workflow Automation

Run the entire workflow in one command:

```bash
pnpm release:workflow <branch-name> [pr-title]
```

**Arguments:**
- `branch-name` (required): Your feature branch name
- `pr-title` (optional): PR title. Defaults to latest commit message

**Example:**
```bash
pnpm release:workflow feat/my-feature "Add awesome feature"
pnpm release:workflow bugfix/issue-123
```

This does everything in sequence:
1. Creates PR from your branch to master
2. Waits for CI to pass
3. Merges the PR
4. Waits for Release Drafter to create draft
5. Shows you the release notes
6. Asks for confirmation and releases

## Tagging & Publishing

### Manual Tag Creation

If you need to create a tag manually:

```bash
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3
```

The npm publish workflow will automatically:
1. Fetch the tag
2. Extract version from tag name (removes `v` prefix)
3. Update package.json
4. Build and test
5. Publish to npm

### Verifying Publication

After releasing, verify the package is on npm:

```bash
npm view @a9s/cli
```

Or install it:

```bash
npm install -g @a9s/cli@latest
a9s --help
```

## Troubleshooting

### PR Creation Fails
- Ensure you're on a feature branch (not master)
- Check you have `gh` CLI authenticated: `gh auth login`

### CI Doesn't Pass
- Review the failing checks in the GitHub PR
- Fix the issues and push to your branch
- Run `pnpm release:merge-if-ci-passes <pr>` again

### No Draft Release Appears
- Release Drafter workflow may be delayed
- Wait a minute and run `pnpm release:draft` again
- Check Actions tab for draft_release workflow status

### npm Publish Fails
- Verify package.json name is `@a9s/cli`
- Ensure version in tag matches what will be published
- Check npm registry: `npm view @a9s/cli@<version>`

## CI/CD Configuration

### Publish Workflow

**File:** `.github/workflows/publish_npm.yaml`

Triggers on: `git push` of tags matching `v*`

Steps:
1. Checkout with all tags
2. Extract version from tag
3. Setup Node.js (LTS)
4. Install dependencies
5. Run typecheck
6. Run tests
7. Build
8. Publish to npm (using trusted publishers/OIDC)

### Release Drafter Workflow

**File:** `.github/workflows/draft_release.yaml`

Triggers on: pushes to master branch

- Automatically creates draft releases
- Groups changes by labels
- Suggests next version

## Package Versioning

The version in `package.json` is kept at `0.0.0` in the repository.

The actual version comes from the git tag:
- Tag format: `v<MAJOR>.<MINOR>.<PATCH>`
- Example: `v1.2.3` → publishes as `@a9s/cli@1.2.3`

This ensures version is single source of truth (the tag) and can't get out of sync.

## Environment Setup

Ensure you have:
- Node.js 18+
- pnpm 10+
- Git
- GitHub CLI: `gh` (with auth: `gh auth login`)

Verify with:
```bash
node --version
pnpm --version
git --version
gh --version
```
