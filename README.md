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
