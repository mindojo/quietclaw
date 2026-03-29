# QuietClaw Desktop Monitor

Cross-platform Electron desktop app for local multi-channel conversation monitoring. Monitors selected groups and channels for urgent messages and generates daily summaries, forwarding them to a configured notification sink (currently Telegram).

## Architecture

```
packages/gateway-contract/   — Shared Zod schemas and TypeScript types for the desktop/live-daemon boundary
packages/ingest-contract/    — Shared Zod schemas and TypeScript types for normalized adapter ingest events
packages/adapter-sdk/        — Shared adapter interfaces and capability/health contracts
packages/adapter-catalog/    — Static catalog of supported and planned messaging adapters
packages/adapter-telegram/   — Telegram Bot API adapter implementation and event mapper
services/live-daemon/        — Local ingest daemon for adapter-sourced traffic from supported messaging platforms
services/simulator/          — Traffic simulator for local testing
apps/desktop-monitor/        — Electron + React desktop app
```

## Quickstart

Requires **Node.js 22+**.

### 1. Install

```bash
npm ci
```

### 2. Start the live daemon

```bash
npm run dev:daemon
```

Starts on `127.0.0.1:38765` by default and accepts adapter-sourced traffic on `/v1/events` and normalized ingest on `/v2/ingest/events`.

### 3. Start the simulator

```bash
npm run dev:simulator
```

### 4. Start the desktop app

```bash
npm run dev:app
```

### 5. Configure Telegram

Open Settings, create a bot with BotFather, paste the bot token, click **Verify**, then open the bot in Telegram and send `/start`.

### 6. Configure monitored groups

1. **Check watched groups** — tick "Daily Summary" and/or "Forward Urgent" for each group to monitor
2. **Set digest time** — choose when the daily summary should be sent (default 20:30)
3. **Save** — click Save in the bottom bar

### 7. Test

Click **Send Test Summary** to send a test digest to Telegram.

## Experimental status

QuietClaw is experimental local-first workflow software. It is designed to process prompts, context, and working data on your device by default.

QuietClaw can also be configured to use third-party model providers selected by the user. When a provider is enabled, selected prompts, attachments, and context may be sent directly to that provider under the user's configuration and subject to that provider's own terms and privacy practices.

QuietClaw is provided on an **as-is** and **as-available** basis, without warranties or guarantees of security, privacy, availability, accuracy, or fitness for any particular purpose. Use it carefully, especially with personal, confidential, regulated, or otherwise sensitive data.

## Privacy and data flow

QuietClaw is designed to be local-first:

- local processing is the default mode;
- third-party provider use is optional;
- prompts and attachments are not intended to be routed through a QuietClaw-operated model relay by default;
- optional features such as updates, telemetry, crash reporting, documentation fetches, or support submission may involve separate network requests if enabled or used.

If you enable a third-party provider, selected content may be sent directly to that provider. That content can include personal data, confidential business information, or other sensitive material if you choose to provide it.

Read before use:

- [Terms of Use](docs/legal/TERMS.md)
- [Privacy Notice](docs/legal/PRIVACY.md)
- [Risk Disclosure](docs/legal/RISK_DISCLOSURE.md)
- [Retention and Deletion](docs/legal/RETENTION_AND_DELETION.md)
- [Third-Party Providers](docs/legal/THIRD_PARTY_PROVIDERS.md)

## Security limitations

QuietClaw is designed with privacy and security in mind, but no local or networked software can guarantee confidentiality or prevent every failure mode.

Known classes of risk include:

- disclosure of prompts, files, or metadata to a third-party provider if enabled;
- prompt injection or malicious instructions embedded in user-provided or retrieved content;
- incorrect, misleading, or unsafe model output;
- local compromise through malware, device sharing, debugging, backups, logs, caches, crash files, or operating-system behavior;
- unknown or emerging risks in LLM-integrated systems.

Do not use QuietClaw with any data or workflow unless you are comfortable evaluating and accepting these risks yourself.

## Retention target

QuietClaw is designed to expire certain local working data after approximately 24 hours.

This is a design target, not a guarantee. Copies may persist longer because of device state, hibernation, OS caches, logs, crash files, backups, debugging artifacts, or software error. Users should assume that local deletion may be delayed or incomplete in some circumstances.

## Key Features

- **Single-page UI** — Telegram setup, watched group checkboxes (Daily Summary / Forward Urgent), digest scheduling, activity log
- **Three inference runners** — Demo (built-in), Codex CLI, Claude CLI
- **Urgent pipeline** — daemon-backed real-time message monitoring with keyword detection and dedupe
- **Digest pipeline** — scheduled daily summaries with configurable time and timezone
- **Runner concurrency** — max 2 concurrent, queue depth 6, graceful shutdown
- **Privacy** — no raw message content persisted to disk

## Testing

```bash
# Unit tests
npx vitest run

# E2E tests (requires packaged app)
cd apps/desktop-monitor && npx electron-forge package && cd ../..
npx playwright test
```

Vitest covers config, daemon state, normalization, dedupe, and Telegram onboarding/client behavior.

## Build Installers

```bash
npm run make:app
```

Produces macOS (DMG/ZIP) and Windows (Squirrel) installers in `apps/desktop-monitor/out/make/`.

## Project Structure

| Package | Description |
|---------|-------------|
| `@quietclaw/gateway-contract` | Zod schemas, TypeScript types, JSON schema generation |
| `@quietclaw/ingest-contract` | Normalized adapter ingest envelope schema and enums |
| `@quietclaw/adapter-sdk` | Channel adapter interface, capabilities, and health types |
| `@quietclaw/adapter-catalog` | Catalog of supported and planned channel adapters |
| `@quietclaw/adapter-telegram` | Telegram adapter and Telegram update mapper |
| `@quietclaw/live-daemon` | Express ingest daemon for adapter-sourced traffic |
| `@quietclaw/desktop` | Electron Forge + React 18 + MUI + TanStack Query |

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

## Community

For general questions and bug reports, see [SUPPORT.md](SUPPORT.md). For contribution expectations, see [CONTRIBUTING.md](CONTRIBUTING.md). For suspected vulnerabilities, see [SECURITY.md](SECURITY.md).
