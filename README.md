# a9s

![npm version](https://img.shields.io/npm/v/@a9s/cli) ![CI](https://img.shields.io/github/actions/workflow/status/IamShobe/a9s/ci.yaml?label=CI) ![GitHub release](https://img.shields.io/github/v/release/IamShobe/a9s)

**k9s-style TUI navigator for AWS services.** Inspired by [k9s](https://github.com/derailed/k9s).

## Installation

### Global install (recommended)
```shell
npm install -g @a9s/cli
a9s
```

### Local install + npx
```shell
npm install @a9s/cli
npx @a9s/cli
```

## Usage

Launch the TUI:
```shell
a9s
```

### Navigation
- **Arrow keys / hjkl**: Navigate between rows
- **Tab**: Switch between columns (sort/filter)
- **Enter**: Drill into details or navigate to the next level
- **Backspace**: Go back to the previous level
- **/** (slash): Search/filter current view
- **:**: Command mode (e.g., `:services` to list available services)
- **?**: Show help panel with all keybindings for current context

### Service Switching
Press `:services` to see the list of available AWS services and switch between them.

### Common Operations
- **d**: Open detail panel for selected row (shows metadata like ARN, tags, etc.)
- **y + key**: Yank/copy shortcuts:
  - `y+n` → copy name
  - `y+a` → copy ARN
  - `y+k` → copy S3 key or other identifiers
- **f**: Fetch/download S3 objects to local path
- **e**: Edit and upload (opens selected item in `$EDITOR`)
- **v**: Toggle reveal/hide secrets (Secrets Manager)

## Services Supported

| Service | Status | Features |
|---------|--------|----------|
| S3 | ✅ | Browse buckets, objects, download, edit, delete |
| IAM | ✅ | List users, roles, policies |
| Route 53 | ✅ | List hosted zones, records |
| Secrets Manager | ✅ | View, edit, and upload secrets |
| DynamoDB | ✅ | List tables, view items |

## Features

- **Responsive tables** with sortable columns
- **Service switching** with `:services` command
- **VIM-inspired shortcuts** (hjkl navigation, commands)
- **Yank mode** for quick copy operations
- **Detail panels** showing rich metadata
- **In-editor editing** with upload confirmation
- **Search/filter** with `/` key
- **Help system** with context-sensitive keybindings
- **LocalStack support** for offline development

## Development

### Prerequisites
- Node.js 18+
- pnpm (for package management)
- Docker (for LocalStack)

### Setup
```bash
pnpm install
```

### Run Against LocalStack

Start LocalStack + seed data:
```bash
pnpm localstack:setup
```

Run the TUI (connects to LocalStack on port 4566):
```bash
pnpm dev:local
```

### Run Against AWS

Connect to your AWS account:
```bash
pnpm dev
```

This will use your `~/.aws/credentials` and `AWS_REGION` environment variable.

### Testing
```bash
pnpm test       # Run tests
pnpm typecheck  # Type checking
pnpm build      # Build TypeScript to dist/
```

### Project Structure
```
src/
  index.tsx          - CLI entry point (commander)
  App.tsx            - Main TUI state machine & layout
  types.ts           - Core types (ColumnDef, TableRow, etc.)
  services.ts        - Service registry
  adapters/          - ServiceAdapter implementations for each AWS service
  views/             - Service-specific views (s3, iam, route53, dynamodb, secretsmanager)
  components/        - Ink/React components (Table, HUD, DetailPanel, etc.)
  hooks/             - Custom React hooks (navigation, state, etc.)
  constants/         - Keybindings, commands
scripts/
  seed.ts            - LocalStack test data seeding
docker/
  docker-compose.yml - LocalStack with services
```

## Goals

### Services (Planned)
- [x] S3
- [x] IAM
- [x] Route 53
- [x] DynamoDB
- [x] Secrets Manager
- [ ] EC2
- [ ] ELB
- [ ] CloudFront

### Features (Planned)
- [x] Responsive tables
- [x] Service switching
- [x] VIM shortcuts
- [x] Yank operations
- [x] Detail panels
- [x] Edit & upload
- [ ] Smart cross-service navigation (e.g., Route53 → ELB)

## License

MIT
