# Contributing

Thanks for your interest in improving QuietClaw.

This repository accepts issues, bug reports, documentation fixes, and pull requests on a best-effort basis. There is no service-level agreement, no guaranteed response time, and no guarantee that any issue or pull request will be reviewed, accepted, merged, or released.

## Before you contribute

- Read [SUPPORT.md](SUPPORT.md) for general support expectations.
- Read [SECURITY.md](SECURITY.md) before reporting suspected vulnerabilities.
- Check for existing issues and pull requests before opening a new one.
- Keep reports and changes focused, specific, and reproducible.

## Reporting bugs

When opening a bug report, include:

- A clear summary of the problem.
- Steps to reproduce it.
- Expected behavior.
- Actual behavior.
- Relevant environment details such as OS, Node.js version, and app version or commit.
- Logs, screenshots, or traces when helpful, but do not include secrets, tokens, private credentials, or sensitive message content.

## Suggesting changes

Feature requests and improvement proposals are welcome, but maintainers may decline ideas that are out of scope, too broad, too risky, or not aligned with the project.

If you are proposing a non-trivial change:

- Describe the use case and expected outcome.
- Explain any tradeoffs or compatibility impact.
- Prefer a small, incremental proposal over a broad redesign.

## Pull requests

Pull requests are welcome for:

- Bug fixes
- Documentation improvements
- Tests
- Small, focused enhancements

To make review easier:

- Keep the change set narrow and avoid unrelated edits.
- Update docs when behavior or setup changes.
- Add or update tests when practical.
- Use clear commit messages and pull request descriptions.

## Project-specific expectations

Contributions should respect the current architecture and repository rules. In particular:

- Do not add cloud infrastructure.
- Do not persist raw daemon-observed message content on disk.
- Keep sensitive operations in Electron main, not renderer.
- Fail closed on ambiguity.
- Use the shared contract packages as the source of truth for daemon payloads.
- Do not add unnecessary native modules.
- Preserve the single-monitor and single outbound-chat assumptions already in the project.

## Local validation

A clean clone should be able to run:

```bash
npm ci
npm run dev:daemon
npm run dev:app
```

Before submitting a pull request, run the relevant checks for your change when possible:

```bash
npm run build
npm run test
```

If you cannot run some checks, say so in the pull request.

## Licensing

By submitting a contribution, you intend for your contribution to be provided under the repository's Apache-2.0 license.

## Maintainer discretion

Maintainers may close issues or pull requests without action, including when they are duplicates, unclear, not reproducible, out of scope, or not a fit for the project.
