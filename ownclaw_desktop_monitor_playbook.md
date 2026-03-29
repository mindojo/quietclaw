
# QuietClaw Desktop Group Monitor App — End-to-End Development Playbook

**Document status:** Final implementation playbook  
**Audience:** A coding agent that will build the desktop app end-to-end  
**Scope:** Build **only** the desktop application plus the **shared local gateway contract package** and a **fully working stub gateway** for local testing.  
**Primary goal:** A user should be able to clone the new repo, run one command to start the stub gateway, run one command to start the desktop app, enter the port/token from the stub, and immediately configure and test monitoring on macOS and Windows.

---

## 1. Executive summary

Build a **new standalone repository** for a desktop application that manages local group monitoring. The app must be a **cross-platform Electron desktop app** for **Windows and macOS**, with a very simple UI and the following capabilities:

1. Connect to a **local gateway** on `127.0.0.1:<port>` using a **Bearer token**.
2. Show gateway health and a list of available groups.
3. Let the user configure a **single monitor** with:
   - a target group (selected first, via dropdown)
   - one or more watched groups, each independently opted into **Summary** and/or **Urgent** (checkboxes with select-all/none)
   - a daily digest time and timezone
   - an inference runner preference: `auto`, `codex`, `claude`, or `demo`
4. Subscribe to live gateway events and process:
   - urgent message checks immediately
   - daily summaries by fetching the previous 24 hours from the gateway
5. Never store gateway message content on disk in the desktop app.
6. Persist only:
   - app settings
   - legal acceptance
   - encrypted gateway token
   - monitor definition (single)
   - scheduler metadata
   - dedupe fingerprints and non-content activity metadata
7. Include a **working stub gateway** that simulates:
   - gateway health changes
   - group discovery changes
   - inbound messages
   - pair/QR states
   - send acknowledgements
   - membership mismatch cases
8. Support local use of **Codex CLI** and **Claude Code CLI** for inference, plus a **built-in demo runner** so the app is fully testable without either CLI installed.
9. Produce build artifacts for **macOS** and **Windows**, and wire in an **auto-update-ready** release flow.

This playbook is deliberately detailed enough that a coding agent can execute it without inventing missing pieces.

---

## 2. Why this is a new standalone repo

Do **not** build this inside the current QuietClaw monorepo. Create a **new repo** dedicated to the desktop app package.

Reasons:

1. The desktop app is intended to be one of two modular replaceable products.
2. The existing repo contains AWS/cloud control-plane concerns that should not leak into this package.
3. Electron/Forge packaging and release workflows are easier to manage cleanly in a desktop-specific repo.
4. The packaged desktop app has a narrower product model than current QuietClaw:
   - target must be exactly **one group**
   - no individual targets
   - no cloud admin panel
   - no Telegram approval flow
5. Electron ecosystem tooling now assumes a modern Node runtime, so a clean repo avoids conflicting constraints.

---

## 3. Final product boundaries

### 3.1 The desktop app owns

- all user-facing UI (single main page + settings overlay)
- legal acknowledgements and warning copy
- gateway connection settings
- single monitor definition
- digest scheduling
- local inference runner orchestration
- local non-content activity history
- update checks
- auto-launch on login
- manual test actions against the stub gateway

### 3.2 The gateway contract owns

- gateway capability discovery
- gateway health status
- group catalog
- group membership snapshots
- last-24-hour message fetches
- live event stream
- send-message API

### 3.3 The desktop app must **not** own

- WhatsApp auth/session internals
- QR transport implementation details
- message retention beyond in-memory processing
- actual gateway transport logic
- cloud services
- embedded model runtimes

---

## 4. Non-negotiable product constraints

These are hard requirements.

### 4.1 Fail-closed behavior

If any material ambiguity exists, the app must block the action rather than pretending success.

Block instead of sending when:

- gateway is disconnected or unhealthy
- gateway token is invalid
- watched group list is empty
- target group equals any watched group
- membership verification fails
- the selected inference runner is unavailable
- inference output is malformed or schema-invalid
- send acknowledgement is absent or ambiguous
- fetched 24-hour history is incomplete or obviously stale
- local clock/scheduler state is inconsistent

### 4.2 Privacy and storage

The desktop app must **never persist raw gateway message text or attachments on disk**.

Allowed persisted data:

- monitor configs
- legal consent state
- encrypted gateway token
- scheduler timestamps
- dedupe fingerprints derived from normalized content hashes
- recent activity metadata without raw content
- runner selection and availability cache
- UI preferences

### 4.3 Renderer trust boundary

The Electron renderer must **not**:

- hold the gateway token in plaintext longer than needed
- directly call localhost HTTP endpoints
- directly spawn `codex` or `claude`
- directly read or write the config store
- directly access the filesystem beyond safe UI-level flows

All sensitive operations belong in the Electron **main process**, exposed via a strict preload API.

### 4.4 Transport truthfulness

The UI must never claim:

- “all groups are loaded”
- “message sent”
- “delivery guaranteed”
- “this product is secure against all local compromise”

The UI must say things like:

- “groups seen by this gateway”
- “send queued”
- “blocked”
- “gateway may still be backfilling”
- “some groups may appear only after traffic or history sync”

---

## 5. Chosen implementation stack

Use the following stack exactly unless a package is unavailable at implementation time.

### 5.1 Desktop application stack

- **Electron**
- **Electron Forge**
- **Webpack** template
- **TypeScript**
- **React 18**
- **Material UI (MUI)** for a mature component system
- **TanStack Query** for request/query orchestration in the renderer
- **Zustand** for lightweight UI state
- **Zod** for runtime validation
- **Luxon** for timezone-safe scheduling
- **electron-store** for local config persistence
- **safeStorage** from Electron for token encryption
- **Playwright** for Electron end-to-end tests
- **Vitest** for unit/integration tests

### 5.2 Stub gateway stack

- **Node 22**
- **TypeScript**
- **Express**
- **Zod**
- **uuid**
- **eventsource-compatible SSE implementation using Express response streaming**
- **tsx** for dev execution

### 5.3 Shared contract package stack

- **TypeScript**
- **Zod**
- **zod-to-json-schema** to generate shareable JSON Schemas for use by runner adapters
- no framework beyond that

### 5.4 Inference runners

Implement three runners:

1. **Demo runner** — built-in, deterministic, no external dependencies
2. **Codex CLI runner**
3. **Claude CLI runner**

The app must be fully usable with **only the demo runner** and the stub gateway.

### 5.5 Release/update stack

- **Electron Forge makers**
  - `@electron-forge/maker-squirrel`
  - `@electron-forge/maker-zip`
  - `@electron-forge/maker-dmg`
- **update-electron-app** for a simple GitHub Releases-driven update path
- GitHub Actions for CI and releases
- macOS signing/notarization support hooks
- Windows signing hooks (optional but supported)

---

## 6. Repository structure to create

Create exactly this structure:

```text
quietclaw-desktop/
  .editorconfig
  .gitignore
  .nvmrc
  README.md
  AGENTS.md
  package.json
  package-lock.json
  tsconfig.base.json

  .github/
    workflows/
      ci.yml
      release.yml

  apps/
    desktop-monitor/
      package.json
      tsconfig.json
      forge.config.ts
      webpack.main.config.ts
      webpack.renderer.config.ts
      webpack.rules.ts

      src/
        main/
          index.ts
          windows.ts
          menu.ts
          logging.ts
          ipc/
            channels.ts
            registerAppIpc.ts
          security/
            secrets.ts
            authHeaders.ts
          config/
            store.ts
            migrations.ts
            schema.ts
          gateway/
            client.ts
            sse.ts
            retry.ts
            formatters.ts
          monitors/
            engine.ts
            urgencyPipeline.ts
            digestPipeline.ts
            scheduler.ts
            membershipGuard.ts
            dedupe.ts
            prompts.ts
            normalization.ts
            runnerManager.ts
            runners/
              demoRunner.ts
              codexRunner.ts
              claudeRunner.ts
          updates/
            updater.ts
          startup/
            bootstrap.ts
            healthMonitor.ts
          util/
            time.ts
            ids.ts
            hashing.ts
            abort.ts

        preload/
          index.ts
          api.ts

        renderer/
          index.tsx
          app/
            App.tsx
            theme.ts
            providers.tsx
          state/
            appStore.ts
          api/
            gatewayQueries.ts
            ipcClient.ts
          components/
            Layout.tsx
            LegalGate.tsx
            HealthIndicator.tsx
            EmptyState.tsx
            DangerNotice.tsx
            GroupList.tsx
            MonitorConfig.tsx
            ActionBar.tsx
            ActivityList.tsx
            RunnerStatusCard.tsx
            SettingsDialog.tsx
            QrPanel.tsx
          pages/
            MainPage.tsx
          styles/
            globals.css

      assets/
        icon.icns
        icon.ico
        icon.png

  packages/
    gateway-contract/
      package.json
      tsconfig.json
      src/
        index.ts
        common.ts
        capabilities.ts
        health.ts
        groups.ts
        members.ts
        messages.ts
        send.ts
        events.ts
        demo.ts
        errors.ts
        jsonSchema.ts

  services/
    stub-gateway/
      package.json
      tsconfig.json
      src/
        index.ts
        server.ts
        auth.ts
        state.ts
        fixtures.ts
        routes/
          capabilities.ts
          health.ts
          groups.ts
          members.ts
          messages.ts
          send.ts
          pair.ts
          demo.ts
          events.ts
        sse/
          broker.ts
        util/
          clock.ts
          prune.ts
          ids.ts

  tests/
    unit/
    integration/
    e2e/
```

---

## 7. Root workspace setup

### 7.1 Root `package.json`

Use npm workspaces:

```json
{
  "name": "quietclaw-desktop",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "npm run build --workspaces",
    "lint": "npm run lint --workspaces",
    "test": "npm run test --workspaces && npm run test:e2e",
    "test:e2e": "playwright test",
    "dev:contract": "npm --workspace @quietclaw/gateway-contract run dev",
    "dev:stub": "npm --workspace @quietclaw/stub-gateway run dev",
    "dev:app": "npm --workspace @quietclaw/desktop run start",
    "build:app": "npm --workspace @quietclaw/desktop run package",
    "make:app": "npm --workspace @quietclaw/desktop run make",
    "generate:schemas": "npm --workspace @quietclaw/gateway-contract run generate:schemas"
  }
}
```

### 7.2 Root `AGENTS.md`

Create an `AGENTS.md` in the new repo with these instructions:

```md
# Agent instructions for this repo

1. Do not add cloud infrastructure.
2. Do not persist raw gateway message content on disk.
3. Keep all sensitive operations in Electron main, not renderer.
4. Fail closed on any ambiguity.
5. Use the shared contract package as the only source of truth for gateway payloads.
6. The stub gateway must remain fully functional for local testing.
7. A clean clone must be able to run:
   - npm ci
   - npm run dev:stub
   - npm run dev:app
8. A clean clone on macOS and Windows must be able to build installers.
9. Do not add unnecessary native modules.
10. The app has exactly one monitor — no multi-monitor UI or data model.
11. Keep watched groups to one or more groups, target to exactly one.
12. Preserve truthful UX copy around partial group discovery and backfill.
```

---

## 8. Shared gateway contract — exact specification

The shared contract package is the **single source of truth**.  
Every request/response/event must be defined in `packages/gateway-contract` first.

### 8.1 Common rules

- Transport: HTTP on `127.0.0.1`
- Authentication: `Authorization: Bearer <token>`
- Content type: `application/json`
- Event stream: Server-Sent Events at `/v1/events/stream`
- Version prefix: `/v1`
- Time format: ISO-8601 UTC strings
- IDs: opaque strings
- Every response must validate through Zod in both:
  - stub gateway server
  - desktop app client

### 8.2 Shared enums

```ts
export const GatewayHealthState = z.enum([
  "PAIRING_REQUIRED",
  "PAIRING",
  "CONNECTED",
  "BACKFILLING",
  "DEGRADED",
  "DISCONNECTED"
]);

export const GroupDiscoveryStatus = z.enum([
  "current",
  "from_sync",
  "waiting_for_traffic",
  "partial"
]);

export const CatalogCompleteness = z.enum([
  "observed_only",
  "history_sync_in_progress",
  "partial",
  "likely_complete",
  "unknown"
]);

export const SendDisposition = z.enum([
  "queued",
  "blocked"
]);

// MonitorMode is no longer needed — each watched group independently
// opts into summary and/or urgent via boolean flags.

export const RunnerPreference = z.enum([
  "auto",
  "demo",
  "codex",
  "claude"
]);

export const MembershipGuardResult = z.enum([
  "passed",
  "blocked_target_contains_unknown_members",
  "blocked_empty_source_members",
  "blocked_empty_target_members",
  "blocked_gateway_unavailable"
]);
```

### 8.3 Error envelope

Every non-2xx response returns:

```ts
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});
```

Examples of `error.code`:

- `UNAUTHORIZED`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `UNSUPPORTED_OPERATION`
- `SEND_BLOCKED`
- `HEALTH_NOT_READY`

### 8.4 `GET /v1/capabilities`

Purpose: tell the desktop app what the gateway can do.

Response schema:

```ts
export const CapabilitiesResponseSchema = z.object({
  apiVersion: z.literal("1.0"),
  providerId: z.string(),
  providerVersion: z.string(),
  features: z.object({
    qrPairing: z.boolean(),
    historySync: z.boolean(),
    groupMembershipSnapshots: z.boolean(),
    messageSend: z.boolean(),
    demoControls: z.boolean()
  }),
  retentionHoursMax: z.number().int().positive(),
  auth: z.object({
    scheme: z.literal("Bearer"),
    tokenRotationSupported: z.boolean()
  })
});
```

Sample response:

```json
{
  "apiVersion": "1.0",
  "providerId": "stub-gateway",
  "providerVersion": "1.0.0",
  "features": {
    "qrPairing": true,
    "historySync": true,
    "groupMembershipSnapshots": true,
    "messageSend": true,
    "demoControls": true
  },
  "retentionHoursMax": 24,
  "auth": {
    "scheme": "Bearer",
    "tokenRotationSupported": false
  }
}
```

### 8.5 `GET /v1/health`

Response schema:

```ts
export const GatewayHealthResponseSchema = z.object({
  state: GatewayHealthState,
  connected: z.boolean(),
  pairingRequired: z.boolean(),
  backfilling: z.boolean(),
  since: z.string(),
  detail: z.string(),
  qrAvailable: z.boolean(),
  observedGroupCount: z.number().int().nonnegative(),
  catalogCompleteness: CatalogCompleteness,
  warnings: z.array(z.string())
});
```

Sample responses:

#### Connected

```json
{
  "state": "CONNECTED",
  "connected": true,
  "pairingRequired": false,
  "backfilling": false,
  "since": "2026-03-22T10:10:00.000Z",
  "detail": "Gateway connected and ready.",
  "qrAvailable": false,
  "observedGroupCount": 4,
  "catalogCompleteness": "partial",
  "warnings": [
    "Some groups may appear only after traffic or history sync."
  ]
}
```

#### Backfilling

```json
{
  "state": "BACKFILLING",
  "connected": true,
  "pairingRequired": false,
  "backfilling": true,
  "since": "2026-03-22T10:12:00.000Z",
  "detail": "Gateway connected and loading additional history.",
  "qrAvailable": false,
  "observedGroupCount": 2,
  "catalogCompleteness": "history_sync_in_progress",
  "warnings": [
    "Daily summaries may be incomplete until backfill finishes."
  ]
}
```

### 8.6 `GET /v1/pair/qr`

This endpoint is optional unless `features.qrPairing === true`.

Response schema:

```ts
export const PairQrResponseSchema = z.object({
  available: z.boolean(),
  expiresAt: z.string().nullable(),
  dataUrlPng: z.string().nullable(),
  detail: z.string()
});
```

Stub gateway behavior:
- if state is `PAIRING_REQUIRED` or `PAIRING`, return a deterministic QR `data:image/png;base64,...`
- otherwise return `available: false`

### 8.7 `GET /v1/groups`

Purpose: list groups currently known to the gateway.

Response schema:

```ts
export const GatewayGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: GroupDiscoveryStatus,
  lastMessageAt: z.string().nullable(),
  messageCount24h: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative().nullable(),
  isTargetEligible: z.boolean(),
  notes: z.array(z.string())
});

export const GroupsResponseSchema = z.object({
  catalogCompleteness: CatalogCompleteness,
  gatewayState: GatewayHealthState,
  groups: z.array(GatewayGroupSchema),
  notices: z.array(z.string())
});
```

Rules:

- `status = "current"` means observed recently in current connected flow
- `status = "from_sync"` means discovered from history sync
- `status = "waiting_for_traffic"` means it may exist but no recent direct traffic has been observed since gateway start
- `status = "partial"` means gateway indicates discovery may still be incomplete
- `isTargetEligible` is `true` unless the gateway explicitly knows the group cannot be sent to

Sample response:

```json
{
  "catalogCompleteness": "partial",
  "gatewayState": "CONNECTED",
  "groups": [
    {
      "id": "grp_parents_001",
      "name": "Parents Committee",
      "status": "current",
      "lastMessageAt": "2026-03-22T09:55:00.000Z",
      "messageCount24h": 12,
      "memberCount": 8,
      "isTargetEligible": true,
      "notes": ["Seen in current session."]
    },
    {
      "id": "grp_building_001",
      "name": "Building Residents",
      "status": "from_sync",
      "lastMessageAt": "2026-03-22T06:10:00.000Z",
      "messageCount24h": 7,
      "memberCount": 12,
      "isTargetEligible": true,
      "notes": ["Loaded from history sync."]
    },
    {
      "id": "grp_school_001",
      "name": "School Updates",
      "status": "waiting_for_traffic",
      "lastMessageAt": null,
      "messageCount24h": 0,
      "memberCount": null,
      "isTargetEligible": true,
      "notes": ["May appear fully only after traffic."]
    },
    {
      "id": "grp_alerts_001",
      "name": "My Alerts",
      "status": "partial",
      "lastMessageAt": "2026-03-22T08:00:00.000Z",
      "messageCount24h": 1,
      "memberCount": 3,
      "isTargetEligible": true,
      "notes": ["Gateway may still be discovering groups."]
    }
  ],
  "notices": [
    "This list reflects groups seen by the gateway.",
    "Some groups may appear only after traffic or history sync."
  ]
}
```

### 8.8 `GET /v1/groups/:groupId/members`

Response schema:

```ts
export const GroupMemberSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable()
});

export const GroupMembersResponseSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  members: z.array(GroupMemberSchema),
  snapshotAt: z.string(),
  reliable: z.boolean(),
  notes: z.array(z.string())
});
```

Rules:
- `reliable=false` means the desktop app must treat the membership guard as potentially blocked if guarding is required
- if `features.groupMembershipSnapshots` is false, the desktop app must treat guard as unavailable and block sends

### 8.9 `GET /v1/groups/:groupId/messages`

Query params:

- `since` — required, ISO-8601 UTC
- `limit` — optional, default 500, max 1000
- `cursor` — optional

Response schema:

```ts
export const GatewayMessageSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  senderId: z.string(),
  senderName: z.string().nullable(),
  timestamp: z.string(),
  text: z.string().nullable(),
  caption: z.string().nullable(),
  hasAttachment: z.boolean(),
  attachmentKind: z.enum(["image", "video", "audio", "document", "other"]).nullable(),
  deliveryHint: z.enum(["live", "history_sync", "unknown"]),
  meta: z.object({
    isEdited: z.boolean().optional(),
    quotedMessageId: z.string().nullable().optional()
  }).optional()
});

export const GroupMessagesResponseSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  since: z.string(),
  returnedCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  complete: z.boolean(),
  messages: z.array(GatewayMessageSchema),
  notes: z.array(z.string())
});
```

Rules:
- gateway returns messages sorted ascending by `timestamp`
- `complete=false` means the desktop app must block digest generation
- for daily digest, the desktop app may paginate until `nextCursor === null`
- the app must never write the returned `messages` to disk

### 8.10 `POST /v1/messages/send`

Request schema:

```ts
export const SendMessageRequestSchema = z.object({
  requestId: z.string(),
  targetGroupId: z.string(),
  text: z.string().min(1).max(12000),
  reason: z.enum(["urgent", "digest", "manual_test"]),
  clientTimestamp: z.string()
});
```

Response schema:

```ts
export const SendMessageResponseSchema = z.object({
  disposition: SendDisposition,
  requestId: z.string(),
  gatewayMessageId: z.string().nullable(),
  detail: z.string(),
  blockedReason: z.string().nullable()
});
```

Rules:
- `queued` means “gateway accepted send request”; it is **not** proof of delivery
- `blocked` means no send attempt should be considered active
- the app must show the wording **queued** or **blocked**, not “sent”

Sample queued response:

```json
{
  "disposition": "queued",
  "requestId": "9e34f5cb-ef11-4e8b-a6f1-14d9e071d2a4",
  "gatewayMessageId": "out_stub_0001",
  "detail": "Send request queued by gateway.",
  "blockedReason": null
}
```

### 8.11 `GET /v1/events/stream`

SSE stream event names:

- `heartbeat`
- `health.updated`
- `group.catalog.updated`
- `message.received`
- `send.ack`

Each SSE event payload uses a common envelope:

```ts
export const EventEnvelopeSchema = z.object({
  type: z.string(),
  emittedAt: z.string(),
  payload: z.unknown()
});
```

Specific payload schemas:

```ts
export const HeartbeatEventPayloadSchema = z.object({
  unixMs: z.number().int()
});

export const HealthUpdatedEventPayloadSchema = GatewayHealthResponseSchema;

export const GroupCatalogUpdatedPayloadSchema = GroupsResponseSchema;

export const MessageReceivedEventPayloadSchema = GatewayMessageSchema.extend({
  live: z.boolean(),
  groupStatus: GroupDiscoveryStatus
});

export const SendAckEventPayloadSchema = z.object({
  requestId: z.string(),
  gatewayMessageId: z.string().nullable(),
  disposition: SendDisposition,
  detail: z.string()
});
```

Heartbeat interval:
- every 15 seconds

Reconnect guidance for client:
- back off 1s, 2s, 5s, 10s, cap at 15s
- on reconnect, immediately refetch health and groups

### 8.12 Demo-only extension endpoints

These are stub-gateway-only capabilities. They must be hidden in the UI when `features.demoControls=false`.

#### `GET /v1/demo/scenarios`

```ts
export const DemoScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(["urgent", "digest", "health", "membership", "pairing"])
});

export const DemoScenariosResponseSchema = z.object({
  scenarios: z.array(DemoScenarioSchema)
});
```

#### `POST /v1/demo/run-scenario`

```ts
export const DemoRunScenarioRequestSchema = z.object({
  scenarioId: z.string()
});

export const DemoRunScenarioResponseSchema = z.object({
  accepted: z.boolean(),
  detail: z.string()
});
```

#### `POST /v1/demo/reset`

```ts
export const DemoResetResponseSchema = z.object({
  ok: z.boolean(),
  detail: z.string()
});
```

---

## 9. Contract package implementation details

### 9.1 Package name

Use:

- `@quietclaw/gateway-contract`

### 9.2 Exports

`packages/gateway-contract/src/index.ts` must export:

- all schemas
- all inferred types
- `parseOrThrow`
- `safeParseContract`
- `buildAuthHeaders(token: string)`
- `jsonSchemaBundle`

### 9.3 JSON schema generation

Generate JSON Schemas for the two inference outputs:

- urgency decision output
- digest decision output

Also generate JSON Schemas for:
- gateway send request/response
- main event payloads

Output them to:

```text
packages/gateway-contract/dist/json-schema/
```

### 9.4 Add strict tests

Contract tests must validate:
- every sample payload in this playbook
- all enums and impossible states
- `text` max lengths
- `complete=false` digest blocking expectation
- `blocked` send response shape
- SSE envelope parsing

---

## 10. Desktop application data model

Create the renderer-visible and main-process persisted data model below.

### 10.1 Persisted config schema

Use `electron-store` in the main process with migrations.

```ts
export const AppConfigSchema = z.object({
  schemaVersion: z.literal(1),

  legal: z.object({
    accepted: z.boolean(),
    acceptedVersion: z.string().nullable(),
    acceptedAt: z.string().nullable()
  }),

  connection: z.object({
    host: z.string().default("127.0.0.1"),
    port: z.number().int().min(1).max(65535).nullable(),
    encryptedToken: z.string().nullable(),
    lastConnectedAt: z.string().nullable(),
    rememberConnection: z.boolean().default(true)
  }),

  monitor: z.object({
    enabled: z.boolean(),
    targetGroupId: z.string().nullable(),
    watchedGroups: z.array(z.object({
      groupId: z.string(),
      dailySummary: z.boolean(),       // include in daily digest
      forwardUrgent: z.boolean()       // forward urgent messages
    })),
    digestTimeLocal: z.string(),     // "HH:mm"
    digestTimezone: z.string(),      // IANA timezone
    runnerPreference: RunnerPreference,
    urgentCooldownMinutes: z.number().int().min(1).max(180).default(30),
    updatedAt: z.string().nullable()
  }),

  scheduler: z.object({
    lastTickAt: z.string().nullable(),
    nextRunAt: z.string().nullable(),
    lastStartedAt: z.string().nullable(),
    lastFinishedAt: z.string().nullable(),
    lastStatus: z.enum(["idle", "running", "success", "blocked", "error"]).default("idle"),
    lastDetail: z.string().nullable()
  }),

  dedupe: z.object({
    urgentFingerprints: z.array(z.object({
      fingerprint: z.string(),
      seenAt: z.string(),
      expiresAt: z.string()
    })).max(2000)
  }),

  activity: z.object({
    entries: z.array(z.object({
      id: z.string(),
      ts: z.string(),
      kind: z.enum([
        "gateway_connected",
        "gateway_disconnected",
        "gateway_backfilling",
        "gateway_pairing_required",
        "monitor_saved",
        "urgent_detected",
        "urgent_skipped",
        "urgent_blocked",
        "urgent_queued",
        "digest_started",
        "digest_blocked",
        "digest_queued",
        "digest_empty",
        "runner_unavailable",
        "membership_blocked",
        "manual_test_sent"
      ]),
      summary: z.string(),
      detail: z.string().nullable()
    })).max(1000)
  }),

  ui: z.object({
    startAtLogin: z.boolean().default(false),
    updateChannel: z.enum(["stable"]).default("stable"),
    settingsOpen: z.boolean().default(false)
  })
});
```

### 10.2 What must never be persisted

Do **not** store any of the following on disk:

- raw inbound message text
- digest source message text
- attachment captions fetched from gateway
- generated digest body previews beyond renderer memory
- generated urgent alert raw reasoning traces
- QR image history

### 10.3 Token encryption

Store only encrypted token bytes in config.

Implementation rules:
- use `safeStorage.isEncryptionAvailable()`
- if available: `safeStorage.encryptString(token)` and base64 encode it
- if not available: still allow storing the token, but:
  - warn the user in UI that OS-backed secret storage is unavailable
  - store it obfuscated but clearly mark this as weaker
- only decrypt in main process on demand

**Token recovery:** If decryption fails at startup (e.g., OS keychain was reset, credential store corrupted):
- clear the stored `encryptedToken`
- surface a connection page banner: "Saved token could not be decrypted. Please re-enter your gateway token."
- log an activity entry `gateway_disconnected` with detail `token recovery required`
- do not crash or block the rest of the UI


### 10.4 Electron security implementation details

Set `BrowserWindow` `webPreferences` to:

- `preload` set to the built preload bundle
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`

Also enforce:

- deny all `window.open` attempts unless there is a deliberate external-link handler
- prevent navigation away from the app shell
- never load remote HTTP/HTTPS content into the renderer
- define a strict Content Security Policy for the renderer bundle:
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'none';
  form-action 'none';
  ```
  Note: `'unsafe-inline'` for styles is required by MUI's runtime styling. All gateway communication happens in main process, so `connect-src` does not need localhost.
- keep all localhost calls and CLI execution in the main process only

The preload layer must expose only a small typed API via `contextBridge`.

---

## 11. Desktop app UX specification

The UI is deliberately minimal: **one main page** plus a **settings dialog** opened via a cogwheel icon. There is no sidebar, no tabs, and no multi-page navigation.

### 11.1 Window behavior

- main window size: `1360x900`
- minimum size: `900x600`
- single main window
- native menu minimal
- skip system tray in v1 on all platforms — add in v2 if requested
- support start-at-login toggle

### 11.2 First launch gate

On first launch, show a full-page legal/warning gate before the rest of the app is usable.

Required copy points:
- educational/experimental use
- user responsibility
- local gateway may expose sensitive local transport data
- the app can forward urgent messages and summaries into a target group
- user must ensure they have the right to do this
- app only sees groups the gateway exposes
- this app is not a guarantee of completeness, delivery, or privacy

Require:
- a checkbox “I understand and accept”
- a button “Continue”

Persist `legal.accepted=true` and a version string such as `desktop-pack-v1`.

### 11.3 Main page layout

The entire app is a single page with a **top bar** and **vertically stacked sections**.

**Top bar:**
- App name “QuietClaw” on the left
- Connection indicator: green/red dot with text “Connected to host:port” or “Disconnected”
- Cogwheel icon button on the far right → opens Settings dialog

The page has two zones: a **sticky config bar** at the top and a **scrollable watched groups list** below.

**Sticky config bar (does not scroll, always visible):**

A single horizontal row with three elements side by side:

1. **Target Group** (left):
   - Label “Target Group” above a dropdown showing the selected group name
   - If no target selected: placeholder “Select target group...” with amber warning border
   - Clicking opens a popup listing all available groups. At the bottom: “Don't see your group? Make sure it exists and has received at least one message.”
   - Until a target is selected, the daily summary controls and the watched groups list below are visually disabled/greyed out

2. **Daily Summary** (middle):
   - Label “Daily Summary” above a compact row: time picker (HH:mm) + timezone dropdown (IANA)
   - Disabled if no target selected

3. **Send Test Summary** (right):
   - Primary button: **”Send Test Summary”**
   - Disabled if no target selected or no watched groups have “Daily Summary” checked
   - When disabled, show subtle hint: “Select a target and at least one group”

**Scrollable watched groups area (fills remaining page height):**

- Header row (sticky within scroll area):
  - “Watched Groups” label on the left
  - Live counters on the right: e.g. “3 daily summary · 2 forward urgent”
  - Column headers:
    - **Group** (wide)
    - **Daily Summary** with select-all checkbox (tri-state: all / none / indeterminate)
    - **Forward Urgent** with select-all checkbox (tri-state)

- Each group row shows:
  - Group name (plain text)
  - Checkbox under “Daily Summary”
  - Checkbox under “Forward Urgent”
- The target group is excluded from this list
- No status chips, no member counts, no message counts, no search/filter
- If a previously saved group is no longer available from the gateway: show the row with a warning icon, strikethrough name, and “Unavailable” badge
- If gateway is disconnected: show empty state with “Connect to a gateway via Settings to see groups”
- If no groups have any checkbox checked: inline warning “Select at least one group to enable monitoring”

- **Save** button at the bottom right of the scroll area

**Bottom bar (always visible):**
- Compact recent activity summary inline (last 3-4 events as condensed text)
- Save button on the right

### 11.4 Settings dialog

Opened by the cogwheel icon. Rendered as a modal dialog overlay.

**Section 1 — Gateway Connection:**
- Host field (default `127.0.0.1`)
- Port field
- Token field (password with toggle)
- Checkbox: “Remember connection”
- Connect / Disconnect buttons
- Refuse non-loopback hosts (only `127.0.0.1`, `localhost`, `::1` allowed)

**Section 2 — Inference Runner:**
- Four selectable cards: Auto (recommended) / Demo (built-in) / Codex CLI / Claude CLI
- Each card shows availability status (green “Available” / grey “Not found”)
- Selected card has a blue ring

**Section 3 — General:**
- Start at login toggle
- Check for updates button

**Section 4 — Legal:**
- Acceptance status text
- “Review terms” link

**Section 5 — Data & Diagnostics:**
- Clear Activity Log button
- Clear Saved Connection button
- Export Diagnostics button (excludes token and message content)

Diagnostics export should contain:
- app version
- OS
- runner availability
- sanitized monitor config
- gateway provider id/version
- recent non-content activity entries

**Footer:** App version in muted text

---

## 12. Main-process architecture

### 12.1 Main-process responsibilities

The Electron main process must handle:

- app boot
- config store read/write
- encryption/decryption of token
- gateway HTTP client
- SSE connection and fanout
- scheduler tick loop
- monitor execution
- runner process spawning
- update checks
- start-at-login changes
- sanitized activity logging
- IPC registration

### 12.2 Preload API surface

Expose a narrow `window.monitorApp` API.

```ts
type MonitorAppApi = {
  getBootstrapState(): Promise<BootstrapState>;
  acceptLegal(version: string): Promise<void>;

  connectGateway(input: {
    host: string;
    port: number;
    token: string;
    rememberConnection: boolean;
  }): Promise<ConnectResult>;

  disconnectGateway(): Promise<void>;
  getGatewayHealth(): Promise<GatewayHealthResponse | null>;
  getGatewayCapabilities(): Promise<CapabilitiesResponse | null>;
  getGroups(): Promise<GroupsResponse | null>;
  getGroupMembers(groupId: string): Promise<GroupMembersResponse>;

  getMonitor(): Promise<DesktopMonitorConfig>;
  saveMonitor(input: DesktopMonitorUpsert): Promise<DesktopMonitorConfig>;
  sendTestSummary(): Promise<ManualRunResult>;

  getRunnerStatus(): Promise<RunnerStatus[]>;
  getActivity(): Promise<ActivityEntry[]>;
  clearActivity(): Promise<void>;

  listDemoScenarios(): Promise<DemoScenario[]>;
  runDemoScenario(id: string): Promise<{ accepted: boolean; detail: string }>;
  resetDemo(): Promise<{ ok: boolean; detail: string }>;

  getSettings(): Promise<AppSettingsView>;
  saveSettings(input: SaveSettingsInput): Promise<AppSettingsView>;
  checkForUpdates(): Promise<UpdateCheckResult>;

  subscribe(listener: (event: RendererSubscriptionEvent) => void): () => void;
};
```

### 12.3 Renderer subscription events

Use IPC push events from main to renderer for:

- gateway health updates
- group catalog updates
- activity appended
- runner status changed
- monitor status changed (digest running/complete)
- update available/downloaded

The renderer should not subscribe directly to gateway SSE.

---

## 13. Gateway client implementation

### 13.1 Client rules

Implement a strict `GatewayClient` in main process.

Responsibilities:
- own `baseUrl`
- own decrypted token in memory only
- send Bearer auth
- parse all responses through contract schemas
- centralize timeout/retry policy
- centralize 401/403 handling
- centralize SSE reconnection

### 13.2 Timeouts

Use these exact timeout defaults:

- `GET /v1/capabilities`: 5s
- `GET /v1/health`: 5s
- `GET /v1/groups`: 10s
- `GET /v1/groups/:id/members`: 10s
- `GET /v1/groups/:id/messages`: 20s
- `POST /v1/messages/send`: 15s
- `GET /v1/pair/qr`: 5s
- demo endpoints: 10s

### 13.3 Retry policy

Do not blindly retry sends.

Allowed retries:
- GET endpoints may retry once on network reset or timeout
- POST demo endpoints may retry once only if no response body was received
- `POST /v1/messages/send` must **not** automatically retry after timeout, to preserve fail-closed semantics

### 13.4 SSE rules

- keep only one active SSE connection
- on disconnect:
  - emit local activity entry
  - back off 1s/2s/5s/10s/15s
  - on reconnect, refetch `health` and `groups`
- if unauthorized (401/403 on SSE connect or mid-stream):
  - close stream
  - clear in-memory decrypted token
  - surface “invalid token” banner in renderer via subscription event
  - redirect user to Connection page
  - do not auto-reconnect until user re-enters valid credentials
- if connected but no heartbeat for > 35 seconds, treat connection as stale, reconnect

---

## 14. Monitor engine behavior

### 14.1 Overview

The monitor engine runs in main process and owns:
- urgent processing
- digest scheduling
- membership verification
- send orchestration
- dedupe
- activity logging

### 14.2 Desktop monitor type

There is exactly **one monitor** in the app. No name field is needed. Each watched group independently opts into summary and/or urgent processing.

```ts
type WatchedGroup = {
  groupId: string;
  dailySummary: boolean;    // include in daily digest
  forwardUrgent: boolean;   // forward urgent messages
};

type DesktopMonitorConfig = {
  enabled: boolean;
  targetGroupId: string | null;
  watchedGroups: WatchedGroup[];
  digestTimeLocal: string;     // "HH:mm"
  digestTimezone: string;      // IANA timezone
  runnerPreference: "auto" | "demo" | "codex" | "claude";
  urgentCooldownMinutes: number;
  updatedAt: string | null;
};
```

### 14.3 Trigger model

#### Urgent pipeline triggers
- only from `message.received` SSE events
- only when the monitor’s `watchedGroups` contains an entry with `groupId === payload.groupId` **and** `forwardUrgent === true`
- only when monitor is enabled
- only when `targetGroupId` is set

#### Digest pipeline triggers
- scheduler ticks every 30 seconds
- when local time in monitor’s timezone crosses or reaches `digestTimeLocal`
- only once per local day
- only when at least one watched group has `dailySummary === true`
- only when monitor is enabled
- only when `targetGroupId` is set

**Scheduler atomicity:** Before starting a digest run, the scheduler must atomically set `scheduler.lastStatus = "running"` and `lastStartedAt = now`. The tick loop must skip if status is already `running`. This prevents double-sends from overlapping ticks (e.g., after sleep/wake).

**Sleep/wake catch-up:** If the machine wakes and the current local time is past the scheduled `digestTimeLocal` but before midnight in the monitor’s timezone, and no successful digest was recorded for today, run the digest immediately (subject to the atomicity guard above). If it is already the next calendar day, skip the missed day — do not retroactively generate a digest for a day the app was asleep.

### 14.4 Dedupe and cooldown

To avoid repeated urgent sends:
- normalize the triggering message content
- compute fingerprint:
  - SHA-256 of `groupId + normalizedText + minuteBucket`
- `minuteBucket = floor(timestamp / (urgentCooldownMinutes * 60 * 1000))`
- if fingerprint exists and not expired, skip
- expiry = `seenAt + urgentCooldownMinutes`

Do **not** store raw message text in dedupe entries.

### 14.5 Cheap urgent prefilter

Before invoking any inference runner, perform a cheap skip check.

A message should be **skipped** if all meaningful content is absent:
- `text` is null/empty/whitespace
- `caption` is null/empty/whitespace
- `hasAttachment=true` with no meaningful text/caption

A message should also be **skipped** if normalized content matches likely-noise patterns only. Use this exact rule set:

1. lower-case
2. trim
3. remove repeated punctuation beyond 2 chars
4. collapse whitespace
5. if resulting text length < 3 → skip
6. if it contains only emojis/symbols/punctuation → skip
7. if it is one of:
   - `ok`
   - `okay`
   - `thanks`
   - `thank you`
   - `thx`
   - `got it`
   - `👍`
   - `🙏`
   - `❤️`
   - `done`
   - `k`
   - `kk`
8. Hebrew equivalents to skip:
   - `תודה`
   - `סבבה`
   - `אוקיי`
   - `מעולה`
   - `קיבלתי`

Only if the message survives this filter should the app call an inference runner.

### 14.6 Urgent message context window

When a live message survives the cheap prefilter:
- use the triggering message
- optionally fetch recent group context from gateway:
  - `since = max(message.timestamp - 3 hours, now - 24h)`
  - include up to 12 most recent messages from the same group ending with the triggering message
- never persist the fetched context
- if context fetch fails, still allow urgency check on the single triggering message

### 14.7 Digest source window

For a digest run:
- for each watched group where `dailySummary === true`:
  - fetch messages since `now - 24h`
  - paginate until `nextCursor === null` or the message limit is reached
- if any response returns `complete=false`, block the digest for that monitor
- max total messages fetched across all groups for a digest run: 1000
- if more than 1000 messages exist, keep the **most recent 1000** after sorting, and add a note to the prompt:
  - `Digest source truncated to the most recent 1000 messages within 24h.`

### 14.8 Digest prefilter

Before building the digest prompt:
- remove messages with no meaningful `text` or `caption`
- remove messages classified as noise by the cheap filter
- keep attachment-bearing messages if caption/text exists
- keep chronology ascending
- if no meaningful messages remain:
  - log `digest_empty`
  - do not send

### 14.9 Membership guard

Before any actual send:
1. fetch target group members
2. fetch member snapshots for all watched groups
3. compute union of watched-group member IDs
4. if any fetch fails, or any watched member snapshot is unreliable, block
5. if target members list is empty or unreliable, block
6. if any target member ID is **not** in the watched-union, block with:
   - `blocked_target_contains_unknown_members`

This preserves the current safety intent: do not send summaries/alerts into a target that appears to include people outside the watched group audience.

Important nuance:
- if the user intentionally wants looser behavior later, that can be a v2 option
- in v1 this guard is **mandatory** and fail-closed

**Membership cache:** To avoid excessive network calls on high-frequency urgent events:
- cache membership snapshots per group for **60 seconds**
- invalidate cache on `group.catalog.updated` SSE events
- cache key: `groupId`; cache value: `{ members, snapshotAt, reliable, fetchedAt }`
- if cache entry is older than 60s, refetch before guard evaluation

### 14.10 Send wording

The app must never write “sent” in the activity history for a gateway queue response.

Use:
- `urgent_queued`
- `digest_queued`
- `manual_test_sent` only if the reason is `manual_test` and disposition is `queued`
- for UI copy use “Queued by gateway” or “Blocked”

---

## 15. Inference runners

The app supports three runner adapters with a common interface.

### 15.1 Common interface

```ts
type UrgencyDecision = {
  urgent: boolean;
  confidence: number;               // 0..1
  category: "safety" | "logistics" | "schedule_change" | "medical" | "security" | "other";
  rationale: string;                // <= 240 chars
  suggestedMessage: string | null;  // <= 1000 chars
};

type DigestDecision = {
  shouldSend: boolean;
  significanceScore: number;        // 0..100
  title: string;                    // <= 120 chars
  summary: string;                  // <= 4000 chars
  bullets: string[];                // <= 12 items
  rationale: string;                // <= 240 chars
};

type RunnerResult<T> = {
  runnerId: "demo" | "codex" | "claude";
  rawDurationMs: number;
  output: T;
};

interface MonitorInferenceRunner {
  id: "demo" | "codex" | "claude";
  checkAvailability(): Promise<RunnerAvailability>;
  runUrgency(input: UrgencyPromptInput, signal: AbortSignal): Promise<RunnerResult<UrgencyDecision>>;
  runDigest(input: DigestPromptInput, signal: AbortSignal): Promise<RunnerResult<DigestDecision>>;
}
```

### 15.2 Output schemas

Use Zod schemas and generate JSON Schemas.

```ts
export const UrgencyDecisionSchema = z.object({
  urgent: z.boolean(),
  confidence: z.number().min(0).max(1),
  category: z.enum(["safety", "logistics", "schedule_change", "medical", "security", "other"]),
  rationale: z.string().min(1).max(240),
  suggestedMessage: z.string().min(1).max(1000).nullable()
});

export const DigestDecisionSchema = z.object({
  shouldSend: z.boolean(),
  significanceScore: z.number().min(0).max(100),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(4000),
  bullets: z.array(z.string().min(1).max(240)).max(12),
  rationale: z.string().min(1).max(240)
});
```

### 15.3 Prompt input formatting

Urgency prompt input:

```ts
type UrgencyPromptInput = {
  watchedGroupName: string;
  targetGroupName: string;
  timestamp: string;
  triggerMessage: {
    senderName: string | null;
    text: string | null;
    caption: string | null;
    hasAttachment: boolean;
    attachmentKind: string | null;
  };
  recentContext: Array<{
    timestamp: string;
    senderName: string | null;
    text: string | null;
    caption: string | null;
  }>;
};
```

Digest prompt input:

```ts
type DigestPromptInput = {
  watchedGroups: Array<{ id: string; name: string }>;
  targetGroupName: string;
  since: string;
  until: string;
  messages: Array<{
    groupName: string;
    timestamp: string;
    senderName: string | null;
    text: string | null;
    caption: string | null;
    hasAttachment: boolean;
    attachmentKind: string | null;
  }>;
};
```

### 15.4 Demo runner

This runner must exist and be production-quality for local testing. It is not a placeholder.

Behavior:

#### Urgency
Mark `urgent=true` if normalized triggering text contains any of:
- `urgent`
- `asap`
- `immediately`
- `now`
- `cancelled`
- `canceled`
- `change of plan`
- `pickup now`
- `medical`
- `ambulance`
- `security`
- `locked out`
- `police`
- Hebrew:
  - `דחוף`
  - `מייד`
  - `עכשיו`
  - `ביטול`
  - `שינוי`
  - `אמבולנס`
  - `משטרה`
  - `רפואי`

Set category according to first strongest match:
- medical keywords → `medical`
- security keywords → `security`
- cancelled/schedule change keywords → `schedule_change`
- pickup/logistics keywords → `logistics`
- otherwise `other`

Use confidence:
- 0.92 for obvious keywords
- 0.80 for moderate
- 0.20 if non-urgent

Suggested message template when urgent:

```text
⚠️ Urgent item detected in {{watchedGroupName}}.

{{senderNameOrUnknown}} wrote:
"{{bestSnippet}}"

Why it may need attention: {{rationale}}
```

Digest behavior:
- score messages by keyword and count
- if fewer than 2 meaningful messages after filtering, `shouldSend=false`
- if keywords include schedule change, meeting, deadline, payment, school, building, maintenance, or medical, raise `significanceScore`
- send if:
  - message count >= 4, or
  - significance score >= 55
- generate:
  - concise title
  - 1–3 paragraph summary
  - up to 6 bullets

This runner must be deterministic and fully testable.

### 15.5 Codex CLI runner

Use Codex CLI non-interactively.

#### Availability check
- command: `codex --version`
- if exit code 0, mark binary available
- do not require network auth validation at app startup
- show “binary available; authentication checked on first use”

#### Execution model
For each run:
1. create a temporary empty directory
2. write:
   - `schema.json`
   - `prompt.txt`
3. invoke Codex with arguments equivalent to:

```bash
codex exec \
  --sandbox read-only \
  --skip-git-repo-check \
  --ephemeral \
  --output-schema /path/to/schema.json \
  --output-last-message /path/to/result.json \
  --cd /path/to/tempdir \
  "<prompt contents>"
```

Implementation notes:
- use `spawn`/`execFile`, not a shell-wrapped command string
- pass arguments as an array for macOS and Windows compatibility
- do not expose the user’s full repo or arbitrary filesystem
- use a temporary empty directory to reduce side effects
- hard timeout:
  - urgent: 60s
  - digest: 120s

After completion:
- read `result.json`
- parse via the local Zod schema
- if parsing fails, mark run blocked

**CLI flag fallback:** If `codex exec` does not support `--output-schema` or `--output-last-message` in the installed version:
- fall back to piping the prompt via stdin and capturing stdout
- append to the prompt: `Return valid JSON matching the following schema: <schema>`
- parse stdout as JSON and validate through Zod
- log a warning activity entry on first fallback use

### 15.6 Claude CLI runner

Use Claude CLI in print mode with JSON schema output.

#### Availability check
- command: `claude --version`
- if exit code 0, binary available
- optionally run `claude auth status --json` if cheap and supported; if not, defer auth check until first use

#### Execution model

Invoke Claude with arguments equivalent to:

```bash
claude -p \
  --output-format json \
  --json-schema "<schema contents>" \
  "<prompt contents>"
```

Implementation notes:
- use `spawn`/`execFile`, not a shell-wrapped command string
- pass arguments as an array for macOS and Windows compatibility
- if supported in the installed version, add `--no-session-persistence`

Timeouts:
- urgent: 60s
- digest: 120s

After completion:
- parse stdout as JSON
- extract structured output payload
- validate through Zod
- if invalid, block

**CLI flag fallback:** If `--json-schema` or `--output-format json` is not supported in the installed Claude CLI version:
- fall back to `-p` mode with schema instructions appended to the prompt
- parse stdout as JSON
- validate through Zod
- if `--no-session-persistence` is not recognized, omit it silently

### 15.7 Runner selection strategy

When monitor `runnerPreference` is:
- `demo` → use demo runner only
- `codex` → use codex only
- `claude` → use claude only
- `auto` → use this priority:
  - on macOS: `codex`, then `claude`, then `demo`
  - on Windows: `claude`, then `codex`, then `demo`

Reason for Windows priority:
- CLI support is usually smoother via Claude CLI today, while Codex Windows flows should still be supported but not prioritized.

### 15.8 Runner concurrency and lifecycle

**Concurrency cap:**
- maintain a global runner queue with max concurrency of **2** simultaneous CLI processes
- if a third run is requested while 2 are in-flight, queue it (FIFO)
- if the queue depth exceeds **6**, drop the oldest queued urgent run and log `urgent_skipped` with detail `runner queue full`
- digest runs are never dropped from the queue — they wait

**Graceful shutdown:**
- on app quit (`app.on('before-quit')`), signal all in-flight runners via their `AbortSignal`
- for CLI runners, send `SIGTERM` to the spawned process
- wait up to 5 seconds for cleanup; then force-kill remaining child processes
- do not mark in-flight runs as `queued` or `success` — mark them as `error` with detail `app shutdown`

### 15.9 Post-processing rules

After runner output:
- clamp confidence to 0..1
- if digest `significanceScore <= 10`, multiply by 10 and clamp to 100
- trim all string fields
- if `urgent=true` but `suggestedMessage=null`, synthesize a fallback urgent message from title/snippet
- if digest `shouldSend=true` but summary is empty, block

---

## 16. Prompt templates

Store these prompt templates in `src/main/monitors/prompts.ts`.

### 16.1 Urgent prompt template

```text
You are reviewing messages from a chat group that a user chose to monitor locally.

Your job is to decide whether the triggering message likely requires prompt human attention.
Be conservative:
- Ignore casual chat, jokes, reactions, thanks, emojis, and normal conversation.
- Focus on urgent logistics, safety, medical, security, or clear schedule changes that likely matter soon.
- If unsure, prefer urgent=false.

Return JSON only, matching the provided schema.

Context:
- Source group: {{watchedGroupName}}
- Target group: {{targetGroupName}}
- Trigger timestamp (UTC): {{timestamp}}

Trigger message:
- Sender: {{triggerSender}}
- Text: {{triggerText}}
- Caption: {{triggerCaption}}
- Has attachment: {{hasAttachment}}
- Attachment kind: {{attachmentKind}}

Recent context (oldest to newest):
{{recentContextBlock}}

Decision rules:
1. urgent=true only when a reasonable person would likely want a prompt alert.
2. confidence must be between 0 and 1.
3. rationale must be short and concrete.
4. suggestedMessage should be concise and ready to send into the target group if urgent=true.
5. If urgent=false, suggestedMessage must be null.
```

### 16.2 Digest prompt template

```text
You are summarizing the last 24 hours of messages from one or more monitored chat groups.

The summary will be forwarded into a single target group.
Be concise, readable, and factual.
Ignore casual noise, repeated acknowledgements, emojis, and low-information chatter.
Highlight schedule changes, deadlines, payments, maintenance, school notices, medical items, security concerns, and decisions that seem useful to preserve.

Return JSON only, matching the provided schema.

Context:
- Target group: {{targetGroupName}}
- Watched groups: {{watchedGroupNames}}
- Window start (UTC): {{since}}
- Window end (UTC): {{until}}

Messages (chronological):
{{messagesBlock}}

Decision rules:
1. shouldSend=true only if the last 24 hours contain enough useful information to justify a forwarded digest.
2. significanceScore must be 0..100.
3. title should be short.
4. summary should be clear and compact.
5. bullets should contain the most important takeaways.
6. rationale should explain briefly why the digest should or should not be sent.
```

### 16.3 Prompt size budgeting

Urgency prompt:
- max rendered prompt size: 16 KB
- if recent context exceeds limit, trim from oldest first but always keep trigger message

Digest prompt:
- max rendered prompt size: 64 KB
- if messages exceed limit:
  - preserve chronology
  - trim oldest remaining messages first
  - append note:
    - `Some older messages were omitted to fit the summarization budget.`

---

## 17. Message normalization and formatting rules

Create helpers in `normalization.ts`.

### 17.1 Meaningful text extractor

For a gateway message, meaningful text is:

1. `text` if present and non-empty after trim
2. otherwise `caption` if present and non-empty
3. otherwise empty

### 17.2 Snippet formatter

Use:
- first 240 chars for urgency context display
- first 400 chars per message in digest prompt
- replace line breaks with ` / `
- collapse repeated whitespace

### 17.3 Sender formatter

If `senderName` is absent:
- use `"Unknown sender"`

### 17.4 Grouped digest formatting

Digest prompt message line format:

```text
[{{timestamp}}] ({{groupName}}) {{senderName}}: {{snippet}}
```

Urgency recent-context line format:

```text
[{{timestamp}}] {{senderName}}: {{snippet}}
```

---

## 18. Stub gateway — full specification

The stub gateway must be genuinely useful for manual and automated testing.

### 18.1 Package name

- `@quietclaw/stub-gateway`

### 18.2 Startup behavior

Default bind:
- host: `127.0.0.1`
- port: `43123`
- token: `quietclaw-demo-token`

Allow overrides by env vars:
- `STUB_GATEWAY_HOST`
- `STUB_GATEWAY_PORT`
- `STUB_GATEWAY_TOKEN`

On startup print:

```text
Stub gateway listening on http://127.0.0.1:43123
Token: quietclaw-demo-token
Provider: stub-gateway/1.0.0
```

### 18.3 Stub initial health

Initial state:
- `CONNECTED`
- `catalogCompleteness = partial`
- `warnings = ["Some groups may appear only after traffic or history sync."]`

### 18.4 Stub fixtures

Create these initial groups:

1. `grp_parents_001`
   - name: `Parents Committee`
   - status: `current`
   - target eligible: true
   - members: `u_alex`, `u_dana`, `u_maya`, `u_ron`, `u_tal`, `u_noa`, `u_yuval`, `u_liat`

2. `grp_building_001`
   - name: `Building Residents`
   - status: `from_sync`
   - target eligible: true
   - members: `u_alex`, `u_dana`, `u_maya`, `u_ron`, `u_yoav`, `u_gil`, `u_liat`, `u_neta`, `u_shai`, `u_noa`, `u_tal`, `u_or`

3. `grp_school_001`
   - name: `School Updates`
   - status: `waiting_for_traffic`
   - target eligible: true
   - members: `u_alex`, `u_dana`, `u_maya`, `u_ron`, `u_tal`

4. `grp_alerts_001`
   - name: `My Alerts`
   - status: `partial`
   - target eligible: true
   - members: `u_alex`, `u_dana`, `u_maya`

5. `grp_alerts_mismatch_001`
   - name: `My Alerts Wide`
   - status: `partial`
   - target eligible: true
   - members: `u_alex`, `u_dana`, `u_maya`, `u_external_001`

These groups must exist at startup.

### 18.5 Initial message fixtures

Pre-populate messages within the last 24 hours:

#### Parents Committee
- “Reminder: class trip payment due by 18:00 tonight.”
- “Pickup moved to the north gate today.”
- “Thanks!”
- “Please bring water tomorrow.”

#### Building Residents
- “Water shutdown on floor 3 from 14:00 to 16:00.”
- “Technician arriving tomorrow morning.”
- “👍”

#### School Updates
- none initially

#### My Alerts
- one harmless previous self-note message

All timestamps should be within the last 12 hours and sorted.

### 18.6 Message retention

Store all stub messages in memory only.
Prune every minute:
- delete any older than 24 hours

### 18.7 Auth middleware

Every endpoint except `/healthz` must require Bearer token.
On missing/invalid token return:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token."
  }
}
```

### 18.8 Health endpoints

Expose:
- `GET /healthz` for process liveness without auth
- `GET /v1/health` for authenticated gateway health

### 18.9 Pairing behavior

Implement these demo pairing states:
- `PAIRING_REQUIRED`
- `PAIRING`

When in those states:
- `qrAvailable=true`
- `GET /v1/pair/qr` returns a deterministic fake PNG data URL or a small placeholder image encoded as data URL

### 18.10 Send endpoint behavior

`POST /v1/messages/send`:
- validate request
- if target group not found → 404
- if health state is neither `CONNECTED` nor `BACKFILLING` → return blocked
- otherwise:
  - create `gatewayMessageId = out_stub_<counter>`
  - append outbound record to internal send log
  - emit `send.ack` SSE event
  - return queued response

### 18.11 Demo scenarios

Implement these scenarios exactly.

#### Scenario: `urgent-cancellation`
- category: `urgent`
- inject one live message into `grp_parents_001`:
  - `text = "Urgent: today's pickup is cancelled. Please collect the kids immediately from the gym entrance."`
- emit:
  - `message.received`
  - update `lastMessageAt`

#### Scenario: `urgent-medical`
- category: `urgent`
- inject message into `grp_building_001`:
  - `text = "Medical emergency in lobby, ambulance requested now."`

#### Scenario: `noise-chat`
- category: `urgent`
- inject:
  - `text = "thanks 🙏"`
- should exercise the client skip path

#### Scenario: `digest-school-day`
- category: `digest`
- add 6 useful messages into `grp_school_001`
  - school trip
  - homework deadline
  - pickup location
  - bring hats/water
  - nurse note
  - payment reminder
- switch group status from `waiting_for_traffic` to `current`
- emit `group.catalog.updated`
- emit `message.received` for final message

#### Scenario: `digest-neighborhood-day`
- category: `digest`
- add 5 useful building messages across maintenance and schedule changes

#### Scenario: `transport-backfill`
- category: `health`
- set health state to `BACKFILLING`
- set `catalogCompleteness=history_sync_in_progress`
- emit `health.updated`

#### Scenario: `connected-ready`
- category: `health`
- set health state to `CONNECTED`
- set `catalogCompleteness=partial`
- emit `health.updated`

#### Scenario: `pairing-required`
- category: `pairing`
- set health state to `PAIRING_REQUIRED`
- emit `health.updated`

#### Scenario: `membership-mismatch`
- category: `membership`
- leave health connected
- do not inject message
- user should choose `My Alerts Wide` as target to test guard block

#### Scenario: `reset`
- not listed as scenario; implemented by `/v1/demo/reset`
- restore initial fixtures and state

### 18.12 SSE broker behavior

The broker must:
- keep a set of connected clients
- write `event:` and `data:` lines correctly
- emit heartbeat every 15 seconds
- remove dead sockets
- allow tests to assert event order

---

## 19. Desktop monitor engine pipelines

### 19.1 Urgent pipeline exact algorithm

For each `message.received` event:

1. parse event payload through contract schema
2. ignore if no connected gateway client state
3. ignore if monitor is not enabled, or `targetGroupId` is null
4. find matching entry in `watchedGroups` where `groupId === payload.groupId` and `forwardUrgent === true`; if none, ignore
6. apply cheap prefilter
7. if skipped:
   - add activity `urgent_skipped`
   - return
8. compute cooldown fingerprint
9. if fingerprint active:
   - add activity `urgent_skipped` with detail `cooldown duplicate`
   - return
10. fetch target group and watched group names from cached group list
11. fetch optional recent context from same group
12. select runner
13. run urgency inference
14. validate output
15. if `urgent=false`:
    - add activity `urgent_skipped`
    - return
16. run membership guard
17. if blocked:
    - add activity `membership_blocked`
    - return
18. send message to gateway
19. if queued:
    - store dedupe fingerprint
    - add activity `urgent_queued`
20. if blocked:
    - add activity `urgent_blocked`

### 19.2 Digest pipeline exact algorithm

Scheduler tick runs every 30 seconds:

1. load monitor config
2. if monitor not enabled, or `targetGroupId` is null, or no watched group has `dailySummary === true`, skip
3. compute current local date/time in monitor timezone
4. determine whether digest is due today and not already completed today
5. if not due, skip
6. atomically mark scheduler state `running` (see 14.3 atomicity rule)
7. add activity `digest_started`
8. fetch 24h messages for each watched group
9. if any fetch incomplete or failed:
   - mark blocked
   - add activity `digest_blocked`
   - return
10. apply digest prefilter
11. if empty:
    - mark success with `digest_empty`
    - return
12. select runner
13. run digest inference
14. validate output
15. if `shouldSend=false`:
    - mark success with detail `runner decided not to send`
    - return
16. run membership guard
17. if blocked:
    - mark blocked, activity `membership_blocked`
    - return
18. compose outbound digest message
19. send to gateway
20. if queued:
    - mark success
    - add activity `digest_queued`
21. else:
    - mark blocked

### 19.3 Digest deduplication

To prevent duplicate digest sends from scheduler + manual overlap or rapid clicks:
- after a digest is successfully queued for a monitor, record `lastDigestSentAt` with the current timestamp
- before any digest send (scheduled or manual), check: if `lastDigestSentAt` is within the past **5 minutes**, block the send and log `digest_blocked` with detail `duplicate prevention — last sent <N>m ago`
- the user can override this by waiting 5 minutes or by using “Send manual test message” (which is not a digest)

### 19.4 “Send Test Summary”

This is the single manual action button. It bypasses scheduler timing but uses the same digest pipeline:
- check monitor has target and at least one watched group with `dailySummary === true`
- fetch last 24h from summary-enabled groups
- run digest inference
- send the resulting summary to the target group
- if no meaningful messages exist, send a short confirmation message instead:

```text
✅ QuietClaw test — no meaningful activity in the last 24 hours.
Target: {{targetGroupName}}
Time: {{localTime}}
This confirms the gateway accepted a send request.
```

Use `reason = manual_test`.

Return shape:

```ts
type ManualRunResult = {
  ok: boolean;
  blocked: boolean;
  detail: string;
  previewText: string | null;
};
```

---

## 20. Digest and urgent outbound message formatting

### 20.1 Urgent outbound formatting

If runner returns `suggestedMessage`, use it.
Otherwise synthesize:

```text
⚠️ Urgent item detected from {{watchedGroupName}}.

{{senderNameOrUnknown}}:
"{{snippet}}"

{{rationale}}
```

Max send text length:
- 3000 chars for urgent
- if exceeded, truncate with `…`

### 20.2 Digest outbound formatting

Format:

```text
📝 {{title}}

{{summary}}

Key points:
- {{bullet1}}
- {{bullet2}}
- {{bullet3}}

Source groups: {{group1}}, {{group2}}, ...
Window: last 24 hours
```

Rules:
- if no bullets, omit section
- cap final message length at 6000 chars
- preserve readability over exhaustive detail

---

## 21. Renderer implementation details

### 21.1 Routing

No routing is needed. The app is a single page. The settings dialog is a modal overlay, not a route.

### 21.2 Data flow

Renderer gets:
- bootstrap state from main on startup
- all privileged data via preload API
- push updates via subscription API
- no direct `fetch` to localhost

### 21.3 Query strategy

Use TanStack Query for:
- `health`
- `capabilities`
- `groups`
- `runnerStatus`
- `activity`

Invalidate queries on:
- connection change
- SSE-driven group/health update
- monitor save
- demo scenario runs

### 21.4 State strategy

Use Zustand for:
- settings dialog open/closed
- connection form draft
- toasts/snackbars
- last manual preview payload

### 21.5 Visual style

Use MUI default theme with a light neutral appearance.
Single-page utility app feel — minimal, functional, everything visible at once.
Do not spend time on custom branding beyond:
- app title
- icon
- clean spacing

---

## 22. Validation rules in UI and main process

Enforce validation in both places.

### 22.1 Monitor validation rules

- target group required (non-null) — must be selected before watched groups can be configured
- at least one watched group with `summary` or `urgent` enabled
- target group must not appear in watched groups
- if any watched group has `dailySummary === true`, digest time is required
- timezone must be valid IANA timezone
- urgent cooldown 1..180
- watched groups must still exist in current group catalog when saving
- target group must still exist and be target eligible when saving

### 22.2 Connection validation rules

- host required
- default `127.0.0.1`
- port integer 1..65535
- token non-empty
- host must be loopback:
  - `127.0.0.1`
  - `localhost`
  - `::1`

### 22.3 Guard against stale group picks

If the saved monitor references a group no longer present in the gateway catalog:
- keep the monitor config
- show a warning next to the stale group entry on the main page
- disable Save/Run actions until the user deselects the missing group

---

## 23. Build and release behavior

### 23.1 Forge config

Configure:
- app name: `QuietClaw`
- executable name: `QuietClaw`
- makers:
  - Squirrel for Windows
  - ZIP for macOS
  - DMG for macOS
- package ignore rules to exclude test sources and local fixtures not needed at runtime

### 23.2 Auto-update

Use `update-electron-app` with GitHub Releases.

Behavior:
- check on startup after 10 seconds
- check every 6 hours
- show “update available” banner
- on update downloaded, offer restart

Environment variables for release:
- `GITHUB_TOKEN` for publishing from CI
- mac signing vars if available
- Windows signing vars if available

### 23.3 macOS signing/notarization hooks

Support:
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Add Forge config hooks so notarization can be enabled in CI when these are present.

### 23.4 Windows signing hooks

If signing credentials are present, wire them in.
If absent, still build unsigned installer for internal testing.

---

## 24. Implementation phases

The coding agent must execute in this exact order.

### Phase 0 — Bootstrap repo

Tasks:
1. initialize workspace repo
2. create root workspace package.json
3. add AGENTS.md
4. add base tsconfig
5. add root scripts
6. add CI placeholders
7. run `npm ci`

Definition of done:
- workspace installs cleanly
- `npm run build` does not fail due to missing scripts

### Phase 1 — Build shared contract package

Tasks:
1. implement all schemas listed above
2. export inferred types
3. add JSON schema generation
4. add contract tests using all sample payloads
5. add a tiny README for the package

Definition of done:
- `npm run generate:schemas` works
- all contract tests pass

### Phase 2 — Build stub gateway

Tasks:
1. create Express server
2. add auth middleware
3. add all `/v1` endpoints
4. add demo endpoints
5. add in-memory state and fixtures
6. add SSE broker
7. add retention pruning
8. add tests:
   - auth
   - health
   - groups
   - messages
   - send
   - scenarios
   - SSE ordering

Definition of done:
- `npm run dev:stub` starts
- user can hit `/v1/capabilities` with token and receive valid response
- demo scenarios work
- all stub tests pass

### Phase 3 — Bootstrap Electron app shell

Tasks:
1. generate Electron Forge Webpack TS app
2. reorganize into `main`, `preload`, `renderer`
3. add MUI, Zustand, TanStack Query, Luxon, electron-store
4. wire preload API skeleton
5. create config store with schema/migrations
6. create legal gate view
7. create single main page layout with empty sections

Definition of done:
- app launches
- legal gate persists acceptance
- main page renders
- no renderer Node access
- preload API available

### Phase 4 — Implement gateway client and connection UI

Tasks:
1. build main-process `GatewayClient`
2. connect form save/load
3. capabilities/health fetch
4. QR panel
5. groups query
6. health/group subscription fanout from main to renderer
7. activity logging for connection changes

Definition of done:
- app connects to stub with `127.0.0.1`, `43123`, `quietclaw-demo-token` via settings dialog
- group list populates on main page
- connection indicator reflects live health changes

### Phase 5 — Implement monitor config and group selection UI

Tasks:
1. monitor config store (single monitor object)
2. group list with checkboxes (watched) and radio buttons (target)
3. save flow with validation
4. display next digest run preview on main page

Definition of done:
- user can select watched groups and target group
- target=watched overlap is blocked
- invalid config cannot be saved

### Phase 6 — Implement runners and engine

Tasks:
1. build `demoRunner`
2. build `runnerManager`
3. build `codexRunner`
4. build `claudeRunner`
5. build urgency pipeline
6. build digest pipeline
7. build scheduler
8. build membership guard
9. build manual test send
10. build manual digest run preview

Definition of done:
- with demo runner only, the app can:
  - configure watched/target groups and save
  - process urgent scenario
  - run a summary
  - send manual test message
- activity list reflects queued/blocked accurately

### Phase 7 — Implement settings dialog, demo scenarios, and polish

Tasks:
1. settings dialog (gateway connection, runners, digest config, general, data management)
2. demo scenario dropdown on main page
3. diagnostics export
4. start-at-login support
5. update checks

Definition of done:
- user can fully demo the app without external CLIs
- settings dialog covers all configuration
- diagnostics export excludes token and raw content

### Phase 8 — Build, package, and release

Tasks:
1. configure Forge makers
2. add CI workflow
3. add release workflow
4. verify `npm run make:app` on macOS and Windows
5. add README quickstart
6. ensure test matrix passes

Definition of done:
- macOS build artifacts produced
- Windows build artifacts produced
- release workflow ready for tags

---

## 25. Exact testing plan

### 25.1 Unit tests

Write unit tests for:

- normalization functions
- cheap-noise prefilter
- digest prefilter
- dedupe fingerprint logic
- scheduler next-run calculation
- membership guard logic
- outbound message formatting
- config migrations
- runner availability detection
- contract parse helpers

### 25.2 Integration tests

Write integration tests for:

1. gateway client parsing valid responses
2. gateway client rejecting invalid responses
3. stub gateway auth behavior
4. urgent pipeline with demo runner
5. urgent pipeline skip on noise
6. digest pipeline with multiple watched groups
7. digest blocking on incomplete history
8. membership guard blocking when target contains external member
9. no on-disk content persistence after runs
10. send endpoint non-retry behavior on timeout ambiguity

### 25.3 End-to-end Playwright tests

Implement these E2E flows:

#### E2E 1 — First launch
- app opens
- legal page shown
- acceptance required
- overview visible after acceptance

#### E2E 2 — Connect to stub
- open settings via cogwheel
- enter `127.0.0.1`, `43123`, `quietclaw-demo-token`
- connect
- close settings
- verify connection indicator shows green "Connected"
- verify group list shows fixtures

#### E2E 3 — Configure monitor
- select target group: `My Alerts` (dropdown)
- verify watched groups section becomes enabled
- check `Parents Committee` — Daily Summary: ☑, Forward Urgent: ☑
- check `School Updates` — Daily Summary: ☑, Forward Urgent: ☐
- save
- verify save button shows success state

#### E2E 4 — Urgent path
- use "Run Demo Scenario" → `urgent-cancellation`
- verify activity list contains `urgent_queued`
- verify no crash

#### E2E 5 — Noise skip
- run scenario `noise-chat`
- verify activity shows `urgent_skipped`

#### E2E 6 — Digest path
- run scenario `digest-school-day`
- click "Send Test Summary"
- verify activity shows `digest_queued`

#### E2E 7 — Membership block
- change target to `My Alerts Wide` (dropdown), save
- click "Send Test Summary"
- verify activity shows `membership_blocked`

#### E2E 8 — Health updates
- run scenario `transport-backfill`
- verify connection indicator reflects backfilling state
- run scenario `pairing-required`
- verify QR panel visible

#### E2E 9 — Settings
- open settings, clear activity, export diagnostics
- verify export file exists and excludes token/raw content

### 25.4 Manual smoke checklist

On macOS and Windows:
1. run stub gateway
2. run desktop app
3. connect via settings
4. select target group
5. check watched groups with Daily Summary / Forward Urgent
6. save monitor config
7. run urgent demo scenario
8. click "Send Test Summary"
9. build installer
10. install built app
11. reconnect to stub
12. verify config persists

---

## 26. CI and release workflow details

### 26.1 CI workflow (`.github/workflows/ci.yml`)

Trigger:
- pull_request
- push to main

Matrix:
- `ubuntu-latest` for contract/stub/unit tests
- `macos-latest` for app build verification
- `windows-latest` for app build verification

Jobs:
1. install Node 22
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `npm run test`
6. on mac/windows additionally run `npm run build:app`

### 26.2 Release workflow (`.github/workflows/release.yml`)

Trigger:
- push tag `v*`

Matrix:
- `macos-latest`
- `windows-latest`

Steps:
1. checkout
2. setup Node 22
3. `npm ci`
4. `npm run test`
5. `npm run make:app`
6. publish artifacts to GitHub Release

If signing env vars are present:
- sign/notarize mac build
- sign Windows build

---

## 27. README quickstart to include

Add a concise `README.md` with these sections:

1. What this repo builds
2. Requirements
   - Node 22
   - npm
3. Install
   - `npm ci`
4. Run stub gateway
   - `npm run dev:stub`
5. Run desktop app
   - `npm run dev:app`
6. Stub defaults
   - host `127.0.0.1`
   - port `43123`
   - token `quietclaw-demo-token`
7. Build app
   - `npm run make:app`
8. Optional inference tools
   - Codex CLI
   - Claude CLI
9. Privacy note
   - app does not persist gateway message content on disk

---

## 28. Critical edge cases to implement and test

The coding agent must not miss these.

### 28.1 Gateway token wrong
- health fetch fails with 401
- UI shows invalid token
- app does not keep retrying indefinitely without user feedback

### 28.2 Gateway reconnects mid-session
- SSE reconnects
- health/groups refetch
- monitor config remains intact

### 28.3 Group disappears after saving
- monitor config remains saved
- UI flags stale groups with warning
- runs blocked until user deselects missing group

### 28.4 Digest due while gateway backfilling
- digest blocks with clear explanation
- no send occurs

### 28.5 Runner missing
- if monitor runner is explicitly `codex` and codex unavailable, block
- if `auto`, fall back to next available

### 28.6 Runner returns malformed JSON
- block
- activity logs `runner_unavailable` or `digest_blocked` / `urgent_blocked` with parse detail
- do not send

### 28.7 Clock skew or duplicate scheduler fire
- at most one digest per local calendar day
- use scheduler state lock (see 14.3 atomicity rule)

### 28.8 Huge digest source window
- trim to 1000 most recent messages
- note truncation in prompt
- no disk persistence

### 28.9 Send request timeout
- do not retry automatically
- mark blocked due to ambiguous send status

### 28.10 User clears saved connection
- token removed
- monitor config remains
- app shows disconnected, group list empty

---

## 29. Definition of complete success

This work is complete only when **all** of the following are true:

1. New standalone repo exists and installs cleanly with Node 22.
2. Shared contract package is complete and tested.
3. Stub gateway is complete and fully usable.
4. Desktop app launches on macOS and Windows.
5. User can connect to stub gateway using host/port/token.
6. User can see group list on main page.
7. User can configure the single monitor with:
   - target group (dropdown, selected first)
   - watched groups with per-group Daily Summary / Forward Urgent checkboxes
   - digest time
   - runner (in settings)
8. Demo runner works end-to-end without Codex or Claude installed.
9. Urgent scenario can queue a send.
10. Digest scenario can queue a send.
11. Membership mismatch can block a send.
12. No raw gateway messages are persisted to disk.
13. Playwright end-to-end tests pass.
14. Forge build artifacts are produced for Windows and macOS.
15. Release workflow is checked in and ready.

---

## 30. Recommended package names

Use these workspace package names:

- `@quietclaw/desktop`
- `@quietclaw/gateway-contract`
- `@quietclaw/stub-gateway`

---

## 31. Implementation notes for the coding agent

These are direct execution notes.

1. Do not over-design the UI. Keep it boring and reliable.
2. Do not add Tailwind, Prisma, or a database.
3. Do not add Electron renderer Node access.
4. Do not add telemetry.
5. Do not add cloud login or remote sync.
6. Do not broaden scope to support Linux packaging in v1.
7. Do not store message text on disk even for debugging.
8. Prefer clear activity logs and deterministic behavior over fancy visuals.
9. Keep all contract examples exactly as specified above.
10. Build the stub gateway early and use it for almost every test.

---

## 32. Suggested initial command sequence for the coding agent

Use this as the concrete starting execution order:

```bash
mkdir quietclaw-desktop
cd quietclaw-desktop

# initialize workspace files and root package.json first
# then:
npm ci

# build the contract package first
npm run generate:schemas

# start stub gateway
npm run dev:stub

# in another terminal start the app
npm run dev:app
```

---

## 33. Future extensions deliberately excluded from this scope

Do not implement these now:

- real WhatsApp gateway
- targeting individuals
- multiple target groups per monitor
- cloud sync
- remote gateway discovery
- TLS on loopback
- advanced prompt editing UI
- analytics
- Linux packaging
- approval workflows

---

## 34. References checked while forming this playbook

These are the external implementation references that informed the stack choices and expected behaviors. They are here for the human owner and for the coding agent if it needs to verify details.

### Electron / Forge
- Electron homepage and docs
- Electron Forge getting started
- Electron Forge Webpack + TypeScript template guidance
- Electron security guidance for context isolation and preload usage
- Electron `safeStorage` API
- Electron `autoUpdater` / update guidance
- `update-electron-app` package guidance

### OpenAI / Codex
- Codex CLI docs
- Codex CLI install docs
- Codex CLI non-interactive `exec` and structured output guidance
- Codex CLI Windows usage docs

### Anthropic / Claude
- Claude Code overview
- Claude Code setup docs
- Claude Code security docs
- Claude CLI `-p`, JSON output, and schema output guidance
- Anthropic product-branding guidance for third-party products

### QuietClaw source behavior used as product source material
- `docs/adr/ADR-001-transport-agnostic-control-plane.md`
- `docs/adr/ADR-002-fail-closed-ambiguous-send-policy.md`
- `ownclaw_group_monitoring_workpack.md`
- `packages/domain/src/types.ts`
- `services/api/src/handlers/groupMonitorRules.ts`
- `services/workers/src/monitorUrgency.ts`
- `services/workers/src/runtimeInbound.ts`
- `apps/admin-v2/views/monitors.js`
- `tests/integration/group-monitor.test.ts`
- `services/wa-qr-transport/src/groupDiscovery.ts`

---

## 35. Final instruction to the coding agent

Build exactly the repo described above.  
Do not ask for more design decisions.  
Use this playbook as the specification.  
Where implementation details are still open, choose the simplest robust path that preserves these invariants:

- fail closed
- no on-disk message content
- main-process trust boundary
- truthful gateway/group UX
- fully working local demo with the stub gateway
- Windows and macOS builds supported
