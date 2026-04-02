# Contributing

Thanks for your interest in contributing to @emstack/request.

## Prerequisites

- Node.js 18+
- pnpm 9+

## Development Setup

```bash
pnpm install
pnpm test
pnpm build
```

## Branching and Commits

- Create a feature branch from your default branch.
- Use Conventional Commits (enforced by commitlint).
- Keep commits focused and atomic.

Examples:

- `feat: add custom retry condition support`
- `fix: handle abort signal merge edge case`
- `docs: improve cache adapter examples`

## Code Quality Requirements

Before opening a pull request, run:

```bash
pnpm lint
pnpm test
pnpm build
```

If formatting is required:

```bash
pnpm format
```

## Pull Request Guidelines

- Explain the problem and solution clearly.
- Link related issues.
- Add or update tests for behavior changes.
- Update docs when API or behavior changes.

## Testing Notes

- Unit tests are under `src/__tests__`.
- Keep coverage healthy for changed areas.
- Prefer deterministic tests over timing-sensitive assertions.

## Reporting Issues

Use GitHub Issues and include:

- Environment (Node version, OS)
- Reproduction steps
- Expected behavior
- Actual behavior
- Minimal reproducible snippet

## Release Process

Releases are automated with semantic-release. Maintainers handle tagging and publishing.
