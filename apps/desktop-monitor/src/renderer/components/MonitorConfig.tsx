import type { DemoScenario } from "@quietclaw/gateway-contract";
import { Typography } from "@mui/material";

import type { TelegramStatus } from "../../preload/api";
import "./Dashboard.css";

type MonitorConfigProps = {
  dailySummarySelectedCount: number;
  demoControlsEnabled: boolean;
  demoPending: boolean;
  demoScenarios: DemoScenario[];
  digestTimeLocal: string;
  digestTimezone: string;
  sendPending: boolean;
  sendTestMessagePending: boolean;
  sendTestDisabledReason: string | null;
  telegramStatus: TelegramStatus;
  timezoneOptions: string[];
  onDigestTimeChange(value: string): void;
  onDigestTimezoneChange(value: string): void;
  onOpenSettings(): void;
  onResetDemo(): void;
  onRunDemoScenario(id: string): void;
  onSendTestMessage(): void;
  onSendTestSummary(): void;
};

export function MonitorConfig({
  dailySummarySelectedCount,
  demoControlsEnabled: _demoControlsEnabled,
  demoPending: _demoPending,
  demoScenarios: _demoScenarios,
  digestTimeLocal,
  digestTimezone,
  sendPending,
  sendTestMessagePending,
  sendTestDisabledReason,
  telegramStatus,
  timezoneOptions: _timezoneOptions,
  onDigestTimeChange,
  onDigestTimezoneChange: _onDigestTimezoneChange,
  onOpenSettings: _onOpenSettings,
  onResetDemo: _onResetDemo,
  onRunDemoScenario: _onRunDemoScenario,
  onSendTestMessage,
  onSendTestSummary,
}: MonitorConfigProps): JSX.Element {
  const [hour = "20", minute = "30"] = digestTimeLocal.split(":");
  const telegramReady = telegramStatus.onboardingState === "ready";

  return (
    <div className="dashboard-card monitor-footer">
      <div>
        <div className="monitor-footer-copy">
          <span className="monitor-footer-label">Daily summary at</span>
          <select
            className="dashboard-select"
            onChange={(event) => onDigestTimeChange(`${event.target.value}:${minute}`)}
            value={hour}
          >
            {["18", "19", "20", "21", "22"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <span>:</span>
          <select
            className="dashboard-select"
            onChange={(event) => onDigestTimeChange(`${hour}:${event.target.value}`)}
            value={minute}
          >
            {["00", "15", "30", "45"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <span className="monitor-footer-timezone">({digestTimezone})</span>
        </div>
        <Typography className="group-list-summary">
          {dailySummarySelectedCount} groups selected for daily summaries
        </Typography>
        {sendTestDisabledReason ? (
          <Typography className="monitor-footer-warning">
            {sendTestDisabledReason}
          </Typography>
        ) : null}
      </div>

      <div className="test-btns">
        <button
          className="dashboard-button sm soft"
          disabled={sendTestMessagePending || !telegramReady}
          onClick={onSendTestMessage}
          type="button"
        >
          {sendTestMessagePending ? "Sending..." : "Send test message"}
        </button>
        <button
          className="dashboard-button sm"
          disabled={sendPending || Boolean(sendTestDisabledReason)}
          onClick={onSendTestSummary}
          type="button"
        >
          {sendPending ? "Sending..." : "Send test summary"}
        </button>
      </div>
    </div>
  );
}
