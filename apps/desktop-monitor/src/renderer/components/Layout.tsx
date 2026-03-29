import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";

import "./Dashboard.css";

type LayoutProps = PropsWithChildren<{
  daemonPort: number;
  engineLabel?: string;
  errorMessage?: string;
  lastUpdateAt: number | null;
  nextSummaryTime?: string;
  settingsActive?: boolean;
  telegramReady: boolean;
  onOpenSettings(): void;
  onRetryConnection(): void;
}>;

export function Layout({
  daemonPort,
  engineLabel = "Claude Code · Haiku",
  errorMessage,
  lastUpdateAt,
  nextSummaryTime,
  settingsActive = false,
  telegramReady,
  onOpenSettings,
  onRetryConnection,
  children,
}: LayoutProps): JSX.Element {
  const ageMs = lastUpdateAt === null ? null : Date.now() - lastUpdateAt;
  const connected = telegramReady;
  const hasRecentMessages = ageMs !== null && ageMs < 5 * 60 * 1000;
  const statusLabel = connected
    ? hasRecentMessages ? `Connected · Listening on ${daemonPort}` : `Connected · Port ${daemonPort} · Waiting for messages`
    : `Disconnected · Port ${daemonPort}`;

  return (
    <Box className="dashboard-layout">
      <div
        className="status-bar"
        style={!connected ? { border: "1px solid rgba(163,45,45,.3)" } : undefined}
      >
        <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
        <span className="status-copy">{statusLabel}</span>
        <span className="status-badge">{engineLabel}</span>
        {nextSummaryTime ? (
          <span className="status-meta">Next summary: {nextSummaryTime}</span>
        ) : null}
        <button
          aria-label="Open settings"
          className={`status-settings${settingsActive ? " active" : ""}`}
          onClick={onOpenSettings}
          type="button"
        >
          <SettingsRoundedIcon fontSize="small" />
        </button>
      </div>
      {errorMessage ? (
        <div className="error-banner">
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>
            {errorMessage}{" "}
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onRetryConnection();
              }}
              style={{ color: "inherit", textDecoration: "underline", fontWeight: 500 }}
            >
              Retry now
            </a>
          </span>
        </div>
      ) : null}

      <Box className="dashboard-shell">{children}</Box>
    </Box>
  );
}
