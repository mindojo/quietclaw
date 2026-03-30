# Agent instructions for this repo

1. Do not add cloud infrastructure.
2. Do not persist raw daemon-observed message content on disk.
3. Keep all sensitive operations in Electron main, not renderer.
4. Fail closed on any ambiguity.
5. Use the shared contract package as the only source of truth for daemon payloads.
6. Telegram bot tokens and outbound sends stay in Electron main only.
7. A clean clone must be able to run:
   - npm ci
   - npm run dev:daemon
   - npm run dev:app
8. A clean clone on macOS and Windows must be able to build installers.
9. Do not add unnecessary native modules.
10. The app has exactly one monitor - no multi-monitor UI or data model.
11. Keep watched groups to one or more groups and Telegram outbound to exactly one chat.
12. Preserve truthful UX copy around partial group discovery and daemon visibility.
13. Keep `git` and `rg` available on developer and agent workstations for repo operations.
