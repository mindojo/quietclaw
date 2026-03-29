import { useEffect, useMemo, useState } from "react";

import type {
  AiTestResult,
  AppSettingsView,
  PromptTemplates,
  RunnerStatus,
  SaveSettingsInput,
  TelegramStatus,
} from "../../preload/api";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  DEFAULT_URGENT_TEMPLATE,
} from "../../main/config/promptDefaults";
import { SummaryPreview, UrgentPreview } from "./PromptPreview";
import { PromptTemplateEditor } from "./PromptTemplateEditor";
import "./Dashboard.css";

function getUtcOffset(tz: string): string {
  try {
    const offset = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ?? "";
    return offset;
  } catch {
    return "";
  }
}

type SettingsDialogProps = {
  open: boolean;
  settings: AppSettingsView;
  runnerStatus: RunnerStatus[];
  saveSettingsPending: boolean;
  telegramPending: boolean;
  telegramStatus: TelegramStatus;
  telegramTokenDraft: string;
  checkForUpdatesPending: boolean;
  exportDiagnosticsPending: boolean;
  clearActivityPending: boolean;
  onClose(): void;
  onOpenLegal(): void;
  onCheckForUpdates(): void;
  onClearActivity(): void;
  onExportDiagnostics(): void;
  onSaveSettings(input: SaveSettingsInput): void;
  onTelegramTokenDraftChange(value: string): void;
  onVerifyTelegram(): void;
};

export function SettingsDialog({
  open,
  settings,
  runnerStatus,
  saveSettingsPending,
  telegramPending: _telegramPending,
  telegramStatus,
  telegramTokenDraft: _telegramTokenDraft,
  checkForUpdatesPending: _checkForUpdatesPending,
  exportDiagnosticsPending: _exportDiagnosticsPending,
  clearActivityPending: _clearActivityPending,
  onClose,
  onOpenLegal: _onOpenLegal,
  onCheckForUpdates: _onCheckForUpdates,
  onClearActivity: _onClearActivity,
  onExportDiagnostics: _onExportDiagnostics,
  onSaveSettings,
  onTelegramTokenDraftChange: _onTelegramTokenDraftChange,
  onVerifyTelegram: _onVerifyTelegram,
}: SettingsDialogProps): JSX.Element {
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [previewMode, setPreviewMode] = useState<"summary" | "urgent" | null>(null);
  const [templates, setTemplates] = useState<PromptTemplates>({
    summary: {
      template: DEFAULT_SUMMARY_TEMPLATE,
      isCustom: false,
    },
    urgent: {
      template: DEFAULT_URGENT_TEMPLATE,
      isCustom: false,
    },
  });
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    settings.runnerPreference === "codex" ? "codex" : "claude",
  );
  const activeRunner = runnerStatus.find((entry) => entry.id === selectedProviderId) ?? runnerStatus.find((entry) => entry.selected) ?? null;
  const providerOptions = runnerStatus.filter((entry) => entry.id === "claude" || entry.id === "codex");
  const telegramReady = telegramStatus.onboardingState === "ready";
  const timezoneOptions = useMemo(() => {
    const zones = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC"];

    return zones.map((tz) => {
      const offset = getUtcOffset(tz);
      return {
        value: tz,
        label: offset ? `${tz} (${offset.replace("GMT", "UTC")})` : tz,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void window.monitorApp.getPromptTemplates().then((result) => {
      if (!cancelled) {
        setTemplates(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTestAi(): Promise<void> {
    setTestRunning(true);
    setTestResult(null);

    try {
      const result = await window.monitorApp.testAiConnection();
      setTestResult(result);
    } catch {
      setTestResult({
        ok: false,
        provider: "Unknown",
        model: "",
        responseTimeMs: 0,
        prompt: "Reply with OK",
        response: "",
        error: "IPC call failed",
      });
    } finally {
      setTestRunning(false);
    }
  }

  function handleResetConnections(): void {
    if (
      window.confirm(
        "Reset connections? This will disconnect Telegram and clear the AI provider. Your groups and settings will be kept.",
      )
    ) {
      void window.monitorApp.resetConnections().then(() => {
        window.location.reload();
      });
    }
  }

  function handleResetEverything(): void {
    if (
      window.confirm(
        "Reset everything? This will remove ALL data and return the app to first-launch state. This cannot be undone.",
      )
    ) {
      void window.monitorApp.resetEverything();
    }
  }

  async function handleSaveTemplate(kind: "summary" | "urgent", template: string): Promise<void> {
    const result = await window.monitorApp.savePromptTemplate(kind, template);
    setTemplates((current) => ({
      ...current,
      [kind]: {
        template,
        isCustom: result.isCustom,
      },
    }));
  }

  async function handleResetTemplate(kind: "summary" | "urgent"): Promise<void> {
    const result = await window.monitorApp.resetPromptTemplate(kind);
    setTemplates((current) => ({
      ...current,
      [kind]: {
        template: result.template,
        isCustom: false,
      },
    }));
  }

  if (!open) {
    return <></>;
  }

  if (previewMode === "summary") {
    return (
      <SummaryPreview
        onBack={() => setPreviewMode(null)}
        template={templates.summary.template}
      />
    );
  }

  if (previewMode === "urgent") {
    return (
      <UrgentPreview
        onBack={() => setPreviewMode(null)}
        template={templates.urgent.template}
      />
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <button className="settings-back" onClick={onClose} type="button">
          <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to dashboard
        </button>
        <span className="settings-title">Settings</span>
      </div>

      <div className="settings-section">
        <p className="settings-label">AI provider</p>
        <div className="settings-provider-grid">
          {providerOptions.map((entry) => (
            <button
              className={`settings-provider-card${entry.id === selectedProviderId ? " selected" : ""}`}
              disabled={saveSettingsPending}
              key={entry.id}
              onClick={() => {
                setSelectedProviderId(entry.id);
                setTestResult(null);
                onSaveSettings({ runnerPreference: entry.id });
              }}
              type="button"
            >
              <div className="settings-provider-head">
                <span className="settings-provider-name">{entry.label}</span>
                <span className={`detection-dot${entry.available ? " available" : ""}`} />
              </div>
              <p className="settings-provider-detail">{entry.detail ?? "Detection unavailable."}</p>
            </button>
          ))}
        </div>
        <p className="settings-helper">Active provider: {activeRunner?.label ?? "Not selected yet"}.</p>
      </div>

      <div className="settings-section">
        <p className="settings-label">Model</p>
        <select className="settings-select" defaultValue={selectedProviderId === "codex" ? "gpt-5.4-low" : "haiku"} id="settings-model">
          {selectedProviderId === "codex" ? (
            <>
              <option value="gpt-5.4-low">GPT-5.4 · Low reasoning (fast, cheapest)</option>
              <option value="gpt-5.4-medium">GPT-5.4 · Medium reasoning (balanced)</option>
              <option value="gpt-5.4-high">GPT-5.4 · High reasoning (thorough, slower)</option>
            </>
          ) : (
            <>
              <option value="haiku">Fast &amp; affordable (Haiku)</option>
              <option value="sonnet">Balanced (Sonnet)</option>
              <option value="opus">Most capable (Opus)</option>
            </>
          )}
        </select>
        <p className="settings-helper">
          {selectedProviderId === "codex"
            ? "Higher reasoning effort produces better summaries but takes longer and uses more tokens."
            : "Switching to Opus uses ~10× more credits per summary."}
        </p>
      </div>

      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p className="settings-label" style={{ marginBottom: 2 }}>Test AI connection</p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
              Verify the provider responds and is authenticated.
            </p>
          </div>
          {testResult?.ok ? (
            <span className="dashboard-button sm" style={{ background: "var(--green)", opacity: 0.7, cursor: "default" }}>Passed ✓</span>
          ) : testResult && !testResult.ok ? (
            <button className="dashboard-button soft sm" onClick={() => void handleTestAi()} type="button">Retry</button>
          ) : (
            <button className="dashboard-button soft sm" disabled={testRunning} onClick={() => void handleTestAi()} type="button">
              {testRunning ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>
        {testRunning ? (
          <div className="test-result pending">
            ⏳ Running: {activeRunner?.id === "codex"
              ? 'codex exec -m gpt-4.1-mini "Reply with OK"'
              : 'claude -p "Reply with OK" --model haiku'}
            {"\n"}  Waiting for response…
          </div>
        ) : null}
        {testResult?.ok ? (
          <div className="test-result pass">
            ✓ {testResult.provider} responded in {(testResult.responseTimeMs / 1000).toFixed(1)}s using model {testResult.model}
            {"\n"}  Prompt: "{testResult.prompt}"
            {"\n"}  Response: "{testResult.response}"
          </div>
        ) : null}
        {testResult && !testResult.ok ? (
          <div className="test-result fail">
            ✗ {testResult.provider} failed after {(testResult.responseTimeMs / 1000).toFixed(1)}s
            {"\n"}  Error: {testResult.error}
            {testResult.provider === "Claude Code"
              ? '\n  Run "claude auth login" in your terminal to authenticate.'
              : ""}
          </div>
        ) : null}
      </div>

      <hr className="settings-divider" />
      <div className="settings-section">
        <p className="settings-label">Prompt templates</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
          Customize how QuietClaw asks the AI to summarize your groups and detect urgent messages.
        </p>
        <PromptTemplateEditor
          defaultTemplate={DEFAULT_SUMMARY_TEMPLATE}
          description="This prompt is sent once per group that has new messages since the last summary. Groups with no messages are automatically skipped. All group summaries are then assembled into a single Telegram message."
          flowSteps={["For each active group", "Send this prompt", "Collect summary", "Assemble into one message"]}
          isCustom={templates.summary.isCustom}
          kind="summary"
          onPreview={() => setPreviewMode("summary")}
          onReset={() => void handleResetTemplate("summary")}
          onSave={(template) => void handleSaveTemplate("summary", template)}
          template={templates.summary.template}
          title="Daily summary prompt"
          variables={[
            { name: "group_name", label: "{{group_name}}" },
            { name: "source", label: "{{source}}" },
            { name: "messages", label: "{{messages}}" },
            { name: "message_count", label: "{{message_count}}" },
            { name: "time_period", label: "{{time_period}}" },
          ]}
        />
        <PromptTemplateEditor
          defaultTemplate={DEFAULT_URGENT_TEMPLATE}
          description="This prompt is sent for every incoming message in groups where urgent forwarding is enabled. The AI must respond with exactly YES or NO. Messages classified as YES are immediately forwarded to your Telegram."
          flowSteps={["New message arrives", "Send this prompt", "YES → forward", "NO → skip"]}
          isCustom={templates.urgent.isCustom}
          kind="urgent"
          onPreview={() => setPreviewMode("urgent")}
          onReset={() => void handleResetTemplate("urgent")}
          onSave={(template) => void handleSaveTemplate("urgent", template)}
          template={templates.urgent.template}
          title="Urgent message detection prompt"
          variables={[
            { name: "group_name", label: "{{group_name}}" },
            { name: "source", label: "{{source}}" },
            { name: "sender_name", label: "{{sender_name}}" },
            { name: "message_text", label: "{{message_text}}" },
          ]}
        />
      </div>

      <hr className="settings-divider" />
      <div className="settings-section">
        <p className="settings-label">Timezone</p>
        <select className="settings-select" defaultValue="Asia/Jerusalem" id="settings-timezone">
          {timezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <hr className="settings-divider" />
      <div className="settings-section">
        <p className="settings-label">Telegram connection</p>
        <div className="settings-row">
          <span className={`status-dot ${telegramReady ? "connected" : "disconnected"}`} />
          <span style={{ fontSize: 13 }}>@{telegramStatus.botUsername ?? "not configured"}</span>
          {telegramReady ? (
            <span style={{ fontSize: 12, color: "var(--green)" }}>Connected</span>
          ) : null}
        </div>
      </div>

      <hr className="settings-divider" />
      <p className="settings-label">Reset options</p>

      <div className="reset-card warn">
        <p className="reset-title" style={{ color: "var(--text-warning)" }}>Reset connections</p>
        <p style={{ color: "var(--text-warning)" }}>
          Disconnects Telegram, clears the bot token, and resets the AI provider selection.
          Restarts the setup wizard from step 1.
        </p>
        <p style={{ color: "var(--text-warning)", fontWeight: 500, marginBottom: 12 }}>
          Keeps: group list, monitoring preferences, prompt templates, summary schedule,
          timezone, and cached messages.
        </p>
        <button
          className="dashboard-button sm"
          onClick={handleResetConnections}
          style={{ background: "#b8860b", border: "none", color: "#fff" }}
          type="button"
        >
          Reset connections…
        </button>
      </div>

      <div className="reset-card danger">
        <p className="reset-title" style={{ color: "var(--text-danger)" }}>Reset everything</p>
        <p style={{ color: "var(--text-danger)" }}>
          Removes all data including prompt templates. Returns the app to its first-launch state.
        </p>
        <p style={{ color: "var(--text-danger)", fontWeight: 500, marginBottom: 12 }}>
          This action cannot be undone.
        </p>
        <button className="dashboard-button btn-danger sm" onClick={handleResetEverything} type="button">
          Reset everything…
        </button>
      </div>

      <p className="settings-helper" style={{ marginTop: 16 }}>v{settings.appVersion}</p>
    </div>
  );
}
