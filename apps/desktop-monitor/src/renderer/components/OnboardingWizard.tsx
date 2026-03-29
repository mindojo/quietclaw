import {
  Box,
  Checkbox,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AiTestResult,
  AiProviderDetection,
  LegalAcceptanceRecord,
  LegalDocumentId,
  TelegramStatus,
  TelegramTokenResult,
} from "../../preload/api";
import { LEGAL_BUNDLE_VERSION } from "../../shared/legalConstants";
import "./OnboardingWizard.css";

type OnboardingWizardProps = {
  appVersion: string;
  legal: LegalAcceptanceRecord;
  legalAccepted: boolean;
  telegramStatus: TelegramStatus;
  onLegalAccepted: (record: LegalAcceptanceRecord) => void;
  onTelegramTokenSet: (token: string) => Promise<TelegramTokenResult>;
  onComplete: () => void;
};

type StepLabel = 1 | 2 | 3 | 4 | 5;
type ProviderId = "claude" | "codex";
type ModelId = "haiku" | "sonnet" | "opus" | "custom";

const defaultTelegramStatus: TelegramStatus = {
  onboardingState: "not_configured",
  botUsername: null,
  chatId: null,
  lastVerifiedAt: null,
};

const emptyAiProviders: AiProviderDetection = {
  claude: false,
  codex: false,
  claudeAuth: {
    loggedIn: false,
    detail: "Not installed",
  },
  codexAuth: {
    loggedIn: false,
    detail: "Not installed",
  },
};

export function OnboardingWizard({
  appVersion,
  legal,
  legalAccepted,
  telegramStatus,
  onLegalAccepted,
  onTelegramTokenSet,
  onComplete,
}: OnboardingWizardProps): JSX.Element {
  const [step, setStep] = useState<number>(legalAccepted ? 1 : 0);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [aiProviders, setAiProviders] = useState<AiProviderDetection | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("haiku");
  const [customModelId, setCustomModelId] = useState("");
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState(false);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [acknowledgedRetention, setAcknowledgedRetention] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(legal.optionalChoices.analyticsOptIn);
  const [crashPrepOptIn, setCrashPrepOptIn] = useState(legal.optionalChoices.crashPrepOptIn);
  const completionTriggeredRef = useRef(false);

  const api = (window as unknown as { monitorApp: import("../../preload/api").MonitorAppApi }).monitorApp;

  const openExternal = (url: string) => {
    void api.openExternal(url);
  };
  const openLegalDocument = (documentId: LegalDocumentId) => {
    void api.openLegalDocument(documentId);
  };

  const safeTelegramStatus = telegramStatus ?? defaultTelegramStatus;
  const telegramReady = safeTelegramStatus.onboardingState === "ready";
  const botLink = safeTelegramStatus.botUsername
    ? `https://t.me/${safeTelegramStatus.botUsername}`
    : "https://t.me/BotFather?start";

  useEffect(() => {
    if (legalAccepted && step === 0) {
      setStep(1);
    }
  }, [legalAccepted, step]);

  function buildLegalRecord(overrides?: Partial<LegalAcceptanceRecord>): LegalAcceptanceRecord {
    return {
      ...legal,
      legalBundleVersion: LEGAL_BUNDLE_VERSION,
      appVersion,
      acceptedAt: legal.acceptedAt ?? new Date().toISOString(),
      locale: navigator.language ?? null,
      platform: navigator.platform ?? null,
      docs: {
        termsVersion: LEGAL_BUNDLE_VERSION,
        privacyVersion: LEGAL_BUNDLE_VERSION,
        riskDisclosureVersion: LEGAL_BUNDLE_VERSION,
        retentionNoticeVersion: LEGAL_BUNDLE_VERSION,
      },
      requiredChecks: {
        acceptedTerms,
        acknowledgedPrivacy,
        acknowledgedRisk,
        acknowledgedRetentionCaveat: acknowledgedRetention,
      },
      optionalChoices: {
        analyticsOptIn,
        crashPrepOptIn,
      },
      providerConsents: legal.providerConsents,
      ...overrides,
    };
  }

  const requiredChecksComplete = acceptedTerms &&
    acknowledgedPrivacy &&
    acknowledgedRisk &&
    acknowledgedRetention;

  useEffect(() => {
    if (step !== 5) {
      return;
    }

    let cancelled = false;

    const detectProviders = async (): Promise<void> => {
      try {
        const result = await window.monitorApp.detectAiProviders();
        if (cancelled) {
          return;
        }

        setAiProviders(result);
        setSelectedProvider((current) => {
          if (current && result[current]) {
            return current;
          }

          if (result.claude) {
            return "claude";
          }

          if (result.codex) {
            return "codex";
          }

          return null;
        });
      } catch {
        if (!cancelled) {
          setAiProviders(emptyAiProviders);
          setSelectedProvider(null);
        }
      }
    };

    void detectProviders();

    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (step !== 6 || completionTriggeredRef.current) {
      return;
    }

    completionTriggeredRef.current = true;
    const timeoutId = window.setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onComplete, step]);

  const currentStepLabel = useMemo<StepLabel | null>(() => {
    if (step >= 1 && step <= 5) {
      return step as StepLabel;
    }

    return null;
  }, [step]);

  async function handleTokenVerify(): Promise<void> {
    const trimmed = tokenDraft.trim();
    if (!trimmed) {
      setTokenError("Paste the token from BotFather before continuing.");
      return;
    }

    setVerifying(true);
    setTokenError(null);

    try {
      const result = await onTelegramTokenSet(trimmed);
      if (result.ok) {
        setStep(4);
        return;
      }

      setTokenError(result.error ?? "Telegram bot verification failed.");
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : "Telegram bot verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSendTestTelegramMessage(): Promise<void> {
    setSendingTest(true);

    try {
      const result = await window.monitorApp.sendTestTelegramMessage();
      if (result.ok) {
        setTestSent(true);
        return;
      }

      setTokenError(result.detail);
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : "Unable to send the test message.");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleFinish(): Promise<void> {
    if (!selectedProvider) {
      return;
    }

    const acceptedAt = new Date().toISOString();
    const providerConsents = [
      ...legal.providerConsents.filter((entry) => entry.providerId !== selectedProvider),
      {
        providerId: selectedProvider,
        providerNoticeVersion: LEGAL_BUNDLE_VERSION,
        acceptedAt,
      },
    ];

    onLegalAccepted(buildLegalRecord({
      providerConsents,
      optionalChoices: {
        analyticsOptIn,
        crashPrepOptIn,
      },
    }));
    await window.monitorApp.saveSettings({
      analyticsOptIn,
      crashPrepOptIn,
      runnerPreference: selectedProvider === "claude" ? "claude" : "codex",
    });
    setStep(6);
  }

  async function handleTestAi(): Promise<void> {
    if (!selectedProvider) {
      return;
    }

    setTestRunning(true);
    setTestResult(null);

    try {
      await window.monitorApp.saveSettings({
        runnerPreference: selectedProvider === "claude" ? "claude" : "codex",
      });
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

  function renderProgress(): JSX.Element | null {
    if (!currentStepLabel) {
      return null;
    }

    return (
      <div className="wizard-progress">
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            className={`wizard-progress-dot${segment < currentStepLabel ? " done" : ""}${segment === currentStepLabel ? " current" : ""}`}
            key={segment}
          />
        ))}
      </div>
    );
  }

  function renderTelegramMock(
    title: string,
    avatarLabel: string,
    messages: Array<{ text: string; user?: boolean }>,
  ): JSX.Element {
    return (
      <div className="tg-mock">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            fontWeight: 500,
            fontSize: 14,
            color: "#1a1a1a",
          }}
        >
          <div className="tg-avatar">{avatarLabel}</div>
          <span>{title}</span>
        </div>
        {messages.map((message, index) => (
          <div className={`tg-bubble${message.user ? " user" : ""}`} key={`${title}-${index}`}>
            {message.text}
          </div>
        ))}
      </div>
    );
  }

  function renderFrame(content: JSX.Element): JSX.Element {
    return (
      <Box
        sx={{
          minHeight: "100%",
          display: "grid",
          placeItems: "center",
          p: { xs: 2, md: 3 },
          background:
            "radial-gradient(circle at top left, rgba(90,154,82,0.08), transparent 30%), var(--bg-secondary)",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 860,
            background: "var(--bg-primary)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(26, 26, 26, 0.08)",
          }}
        >
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>{content}</Box>
        </Box>
      </Box>
    );
  }

  if (step === 6) {
    return renderFrame(
      <Box
        onClick={() => onComplete()}
        sx={{
          textAlign: "center",
          py: { xs: 6, md: 8 },
          px: 2,
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--bg-success)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
            color: "var(--green)",
            fontSize: 30,
          }}
        >
          ✓
        </Box>
        <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 1 }}>You&apos;re all set!</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
          QuietClaw is ready to continue into the live monitor. This screen will close
          automatically in a moment.
        </Typography>
      </Box>,
    );
  }

  let content: JSX.Element;

  if (step === 0) {
    content = (
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 22, fontWeight: 600 }}>Before you start</Typography>

          <Typography color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.6 }}>
            QuietClaw is experimental local-first software. It processes data on your device by default.
            If you enable a third-party AI provider, selected prompts and context may be sent to that provider.
            Sensitive information may be exposed due to software defects, device compromise, provider handling,
            prompt injection, logs, caches, or other failure modes. Local working data is designed to expire
            after ~24 hours but may persist longer. The software is provided as-is, without warranties.
          </Typography>

          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
            <Typography sx={{ fontSize: 11, color: "var(--text-tertiary)", mr: 0.5 }}>Review:</Typography>
            <button className="wizard-btn wizard-btn-outline sm" onClick={() => openLegalDocument("TERMS.md")} type="button">Terms</button>
            <button className="wizard-btn wizard-btn-outline sm" onClick={() => openLegalDocument("PRIVACY.md")} type="button">Privacy</button>
            <button className="wizard-btn wizard-btn-outline sm" onClick={() => openLegalDocument("RISK_DISCLOSURE.md")} type="button">Risks</button>
            <button className="wizard-btn wizard-btn-outline sm" onClick={() => openLegalDocument("RETENTION_AND_DELETION.md")} type="button">Retention</button>
          </Box>

          <Stack spacing={0.25}>
            <label className="wizard-check"><Checkbox size="small" sx={{ p: 0.5 }} checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} /><span style={{ fontSize: 13 }}>I accept the Terms of Use.</span></label>
            <label className="wizard-check"><Checkbox size="small" sx={{ p: 0.5 }} checked={acknowledgedPrivacy} onChange={(e) => setAcknowledgedPrivacy(e.target.checked)} /><span style={{ fontSize: 13 }}>I have read the Privacy Notice.</span></label>
            <label className="wizard-check"><Checkbox size="small" sx={{ p: 0.5 }} checked={acknowledgedRisk} onChange={(e) => setAcknowledgedRisk(e.target.checked)} /><span style={{ fontSize: 13 }}>I understand QuietClaw is experimental — privacy, security, and correctness are not guaranteed.</span></label>
            <label className="wizard-check"><Checkbox size="small" sx={{ p: 0.5 }} checked={acknowledgedRetention} onChange={(e) => setAcknowledgedRetention(e.target.checked)} /><span style={{ fontSize: 13 }}>Local data expires after ~24h but may persist longer.</span></label>
          </Stack>

          <Stack spacing={0.25}>
            <label className="wizard-check optional"><Checkbox size="small" sx={{ p: 0.5 }} checked={analyticsOptIn} onChange={(e) => setAnalyticsOptIn(e.target.checked)} /><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Share anonymous usage analytics.</span></label>
            <label className="wizard-check optional"><Checkbox size="small" sx={{ p: 0.5 }} checked={crashPrepOptIn} onChange={(e) => setCrashPrepOptIn(e.target.checked)} /><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Allow crash reports to be prepared for review.</span></label>
          </Stack>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <button
            className="wizard-btn wizard-btn-outline"
            onClick={() => window.close()}
            type="button"
          >
            Decline and exit
          </button>
          <button
            className="wizard-btn"
            disabled={!requiredChecksComplete}
            onClick={() => {
              onLegalAccepted(buildLegalRecord({
                acceptedAt: new Date().toISOString(),
              }));
              setStep(1);
            }}
            type="button"
          >
            Agree and continue
          </button>
        </Box>
      </Stack>
    );
  } else if (step === 1) {
    content = (
      <Stack spacing={0}>
        {renderProgress()}
        <Typography sx={{ fontSize: 12, color: "var(--text-tertiary)", mb: 0.75 }}>
          STEP 1
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 500, mb: 0.5 }}>Create your Telegram bot</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.6, mb: 2 }}>
          QuietClaw delivers alerts through your own Telegram bot. Start in BotFather and create a
          new bot first.
        </Typography>

        <div className="wizard-card">
          <button
            className="wizard-btn"
            onClick={() => openExternal("https://t.me/BotFather?start")}
            type="button"
          >
            Open BotFather in Telegram →
          </button>
          {renderTelegramMock("BotFather", "B", [
            { text: "/newbot", user: true },
            { text: "Alright, a new bot. How are we going to call it?" },
            { text: "Something like QuietClaw Monitor works well." },
          ])}
        </div>

        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
          <button className="wizard-btn" onClick={() => setStep(2)} type="button">
            Continue →
          </button>
        </Box>
      </Stack>
    );
  } else if (step === 2) {
    content = (
      <Stack spacing={0}>
        {renderProgress()}
        <Typography sx={{ fontSize: 12, color: "var(--text-tertiary)", mb: 0.75 }}>
          STEP 2
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 500, mb: 0.5 }}>Name it clearly</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.6, mb: 2 }}>
          Pick a display name you recognize and a username that ends with <code>bot</code>. Keep
          it obviously tied to this machine so you do not confuse it with another automation bot
          later.
        </Typography>

        <div className="wizard-card">
          {renderTelegramMock("BotFather", "B", [
            { text: "QuietClaw Monitor", user: true },
            { text: "Good. Now send me the username for your bot." },
            { text: "quietclaw_helper_bot", user: true },
            { text: "Done. I will generate a token next." },
          ])}
        </div>

        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
          <button className="wizard-btn wizard-btn-outline" onClick={() => setStep(1)} type="button">
            ← Back
          </button>
          <button className="wizard-btn" onClick={() => setStep(3)} type="button">
            Continue →
          </button>
        </Box>
      </Stack>
    );
  } else if (step === 3) {
    content = (
      <Stack spacing={0}>
        {renderProgress()}
        <Typography sx={{ fontSize: 12, color: "var(--text-tertiary)", mb: 0.75 }}>
          STEP 3
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 500, mb: 0.5 }}>Paste the bot token</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.6, mb: 2 }}>
          Paste the token exactly as BotFather returned it. QuietClaw verifies it in Electron main
          and does not need you to store it anywhere else manually.
        </Typography>

        {tokenError ? <div className="error-banner">⚠ {tokenError}</div> : null}

        <div className="wizard-card">
          <TextField
            error={Boolean(tokenError)}
            fullWidth
            inputProps={{
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: 14,
              },
            }}
            onChange={(event) => {
              setTokenDraft(event.target.value);
              if (tokenError) {
                setTokenError(null);
              }
            }}
            placeholder="Paste your token here..."
            type="text"
            value={tokenDraft}
            variant="outlined"
          />
          <Typography color="text.secondary" sx={{ fontSize: 12, mt: 1 }}>
            Format hint: <code>123456789:AAExampleLongTokenFromBotFather</code>
          </Typography>
          <div className="info-tip">
            <span>i</span>
            <span>Your token stays in the main process and is used only for Telegram delivery.</span>
          </div>
        </div>

        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
          <button className="wizard-btn wizard-btn-outline" onClick={() => setStep(2)} type="button">
            ← Back
          </button>
          <button className="wizard-btn" disabled={verifying} onClick={() => void handleTokenVerify()} type="button">
            {verifying ? "Verifying..." : "Verify & continue →"}
          </button>
        </Box>
      </Stack>
    );
  } else if (step === 4) {
    content = (
      <Stack spacing={0}>
        {renderProgress()}
        <Typography sx={{ fontSize: 12, color: "var(--text-tertiary)", mb: 0.75 }}>
          STEP 4
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 500, mb: 0.5 }}>Activate your bot</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.6, mb: 1.5 }}>
          Open your bot in Telegram and press <strong>Start</strong> to give QuietClaw permission to message you.
        </Typography>

        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: action + mock */}
          <Box sx={{ flex: "1 1 300px" }}>
            <button className="wizard-btn" onClick={() => openExternal(botLink)} type="button" style={{ marginBottom: 8 }}>
              Open my bot in Telegram →
            </button>

            {/* Compact Telegram mock */}
            <div className="tg-mock" style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontWeight: 500, fontSize: 13 }}>
                <div className="tg-avatar" style={{ background: "var(--green)", width: 24, height: 24, fontSize: 12 }}>Q</div>
                <span>{safeTelegramStatus.botUsername ? `@${safeTelegramStatus.botUsername}` : "My QuietClaw"}</span>
              </div>
              <div style={{ textAlign: "center", padding: "1.5rem 0", fontSize: 13, color: "var(--text-tertiary)" }}>No messages yet</div>
              <div style={{ paddingTop: 8, borderTop: "1px solid rgba(0,0,0,.08)", textAlign: "center" }}>
                <button style={{
                  padding: "6px 0", width: "100%",
                  background: "linear-gradient(180deg, #4BA3F5 0%, #1E88D0 100%)",
                  color: "#fff", border: "none", borderRadius: 6, fontSize: 13,
                  fontWeight: 500, fontFamily: "var(--font-sans)", cursor: "default",
                }} type="button">Start</button>
              </div>
            </div>
          </Box>

          {/* Right: status + test */}
          <Box sx={{ flex: "1 1 200px" }}>
            {!telegramReady ? (
              <div className="info-tip" style={{ margin: "0 0 8px" }}>
                <span>⏳</span>
                <span style={{ fontSize: 12 }}>Waiting for <code>/start</code> in Telegram…</span>
              </div>
            ) : (
              <div className="success-banner" style={{ margin: "0 0 8px" }}>
                <span>✓</span>
                <span style={{ fontSize: 12 }}>Bot activated — ready to send messages.</span>
              </div>
            )}

            {tokenError && step === 4 ? <div className="error-banner" style={{ margin: "0 0 8px" }}>⚠ {tokenError}</div> : null}

            <p style={{ fontSize: 13, margin: "0 0 6px", fontWeight: 500 }}>Confirm it works:</p>
          <button
            className={`wizard-btn${testSent ? " wizard-btn-outline" : ""}`}
            disabled={!telegramReady || sendingTest}
            onClick={() => void handleSendTestTelegramMessage()}
            style={{ marginTop: 4 }}
            type="button"
          >
            {sendingTest
              ? "Sending..."
              : testSent
                ? "Sent! Check Telegram ✓"
                : "Send me a test message"}
          </button>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
          <button className="wizard-btn wizard-btn-outline" onClick={() => setStep(3)} type="button">
            ← Back
          </button>
          <button className="wizard-btn" disabled={!telegramReady} onClick={() => setStep(5)} type="button">
            Continue →
          </button>
        </Box>
      </Stack>
    );
  } else {
    const providersLoaded = aiProviders !== null;
    const noProvidersFound = providersLoaded && !aiProviders.claude && !aiProviders.codex;
    const selectedModelSummary = selectedModel === "custom" ? customModelId.trim() || "Custom model" : selectedModel;

    content = (
      <Stack spacing={0}>
        {renderProgress()}
        <Typography sx={{ fontSize: 12, color: "var(--text-tertiary)", mb: 0.75 }}>
          STEP 5
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 500, mb: 0.5 }}>Choose the AI engine</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.6, mb: 2 }}>
          QuietClaw can run through either local CLI. Pick the provider detected on this machine,
          then choose the model tier you want to start with.
        </Typography>

        {!providersLoaded ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {noProvidersFound ? (
              <div className="error-banner">
                <span>⚠</span>
                <span>
                  No supported AI CLI was found. Install <code>claude</code> or <code>codex</code>,
                  then re-check this step.
                </span>
              </div>
            ) : null}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mb: 2 }}>
              {([
                {
                  id: "claude" as const,
                  title: "Claude Code",
                  detail: "by Anthropic",
                  authKey: "claudeAuth" as const,
                },
                {
                  id: "codex" as const,
                  title: "Codex CLI",
                  detail: "by OpenAI",
                  authKey: "codexAuth" as const,
                },
              ]).map((provider) => {
                const detected = aiProviders[provider.id];
                const auth = aiProviders[provider.authKey];
                const selected = selectedProvider === provider.id;

                return (
                  <div
                    className={`provider-card${selected ? " selected" : ""}${detected ? "" : " disabled"}`}
                    key={provider.id}
                    onClick={() => {
                      if (detected) {
                        setSelectedProvider(provider.id as ProviderId);
                        setTestResult(null);
                      }
                    }}
                    role="button"
                    tabIndex={detected ? 0 : -1}
                    onKeyDown={(event) => {
                      if (detected && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        setSelectedProvider(provider.id as ProviderId);
                        setTestResult(null);
                      }
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack alignItems="center" direction="row" justifyContent="space-between">
                        <Typography sx={{ fontWeight: 600 }}>{provider.title}</Typography>
                        <Stack alignItems="center" direction="row" spacing={0.75}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: detected
                                ? auth?.loggedIn ? "var(--green)" : "#e6a817"
                                : "var(--border-light)",
                            }}
                          />
                          <Typography sx={{ fontSize: 12, color: detected ? (auth?.loggedIn ? "var(--green)" : "#e6a817") : "var(--text-secondary)" }}>
                            {!detected ? "Not found" : auth?.loggedIn ? "Ready ✓" : "Installed · not logged in"}
                          </Typography>
                        </Stack>
                      </Stack>
                      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                        {provider.detail}
                      </Typography>
                      {detected && auth?.detail ? (
                        <Typography sx={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                          {auth.detail}
                        </Typography>
                      ) : null}
                    </Stack>
                  </div>
                );
              })}
            </Box>

            <div className="info-tip">
              <span>ℹ</span>
              <span>
                When enabled, QuietClaw may send selected prompts and context directly to the chosen provider to generate summaries and urgency assessments. Data sent is handled under that provider&apos;s terms and privacy documentation. Only enable a provider for data you are comfortable sending to that provider.
              </span>
            </div>

            {noProvidersFound ? (
              <div className="wizard-card">
                <Typography sx={{ fontSize: 13, color: "var(--text-secondary)", mb: 1 }}>
                  Install one of these CLIs, then check again:
                </Typography>
                <Typography component="div" sx={{ fontFamily: "var(--font-mono)", fontSize: 12, mb: 1 }}>
                  npm install -g @anthropic-ai/claude-code
                </Typography>
                <Typography component="div" sx={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  npm install -g @openai/codex
                </Typography>
              </div>
            ) : null}

            <div className="wizard-card">
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Model tier</Typography>
              {([
                {
                  id: "haiku",
                  title: "Haiku",
                  detail: "Faster and lighter for everyday message classification.",
                },
                {
                  id: "sonnet",
                  title: "Sonnet",
                  detail: "More reasoning depth for nuanced summarization.",
                },
                {
                  id: "opus",
                  title: "Opus",
                  detail: "Highest-cost tier for the hardest edge cases.",
                },
              ] as const).map((model) => (
                <div
                  className={`model-option${selectedModel === model.id ? " selected" : ""}`}
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedModel(model.id);
                    }
                  }}
                >
                  <Stack spacing={0.25}>
                    <Typography sx={{ fontWeight: 500 }}>{model.title}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                      {model.detail}
                    </Typography>
                  </Stack>
                  {model.id === "haiku" ? <span className="model-recommended">Recommended</span> : null}
                </div>
              ))}

              <details style={{ marginTop: 10 }}>
                <summary>Advanced: custom model ID</summary>
                <TextField
                  fullWidth
                  inputProps={{ style: { fontFamily: "var(--font-mono)", fontSize: 14 } }}
                  onChange={(event) => {
                    setSelectedModel("custom");
                    setCustomModelId(event.target.value);
                  }}
                  placeholder="provider/model-id"
                  sx={{ mt: 1.25 }}
                  value={customModelId}
                />
              </details>

              <div className="info-tip">
                <span>i</span>
                <span>
                  Current persistence is provider-only. The model shown here stays in the setup UI
                  for now: <code>{selectedModelSummary}</code>.
                </span>
              </div>
            </div>

            <div className="wizard-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Test your AI engine</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                    Sends a quick prompt to verify the provider is responding and properly authenticated.
                  </p>
                </div>
                {testResult?.ok ? (
                  <span className="wizard-btn sm" style={{ background: "var(--green)", opacity: 0.7, cursor: "default" }}>Passed ✓</span>
                ) : testResult && !testResult.ok ? (
                  <button className="wizard-btn sm soft" onClick={() => void handleTestAi()} type="button">Retry</button>
                ) : (
                  <button
                    className="wizard-btn sm soft"
                    disabled={testRunning || !selectedProvider}
                    onClick={() => void handleTestAi()}
                    type="button"
                  >
                    {testRunning ? "Testing…" : "Test connection"}
                  </button>
                )}
              </div>
              {testRunning ? (
                <div className="test-result pending">
                  ⏳ Running: {selectedProvider === "codex"
                    ? 'codex exec --ephemeral "Is this message urgent? ..."'
                    : 'claude -p --model haiku "Is this message urgent? ..."'}
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

            {testResult?.ok ? (
              <div className="success-banner"><span style={{ flexShrink: 0 }}>✓</span><span>AI engine is working. You're ready to go!</span></div>
            ) : null}
            {testResult && !testResult.ok ? (
              <div className="error-banner"><span style={{ flexShrink: 0 }}>⚠</span><span>The AI engine didn't respond. Check that you're logged in. You can still finish setup and test again later from settings.</span></div>
            ) : null}
          </>
        )}

        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap" }}>
          <button className="wizard-btn wizard-btn-outline" onClick={() => setStep(4)} type="button">
            ← Back
          </button>
          {providersLoaded ? (
            <button
              className="wizard-btn wizard-btn-outline"
              onClick={() => {
                setAiProviders(null);
                setTestResult(null);
                void window.monitorApp.detectAiProviders().then((result) => {
                  setAiProviders(result);
                  setSelectedProvider(result.claude ? "claude" : result.codex ? "codex" : null);
                }).catch(() => {
                  setAiProviders(emptyAiProviders);
                  setSelectedProvider(null);
                });
              }}
              type="button"
            >
              Re-check
            </button>
          ) : null}
          <button
            className="wizard-btn"
            disabled={!selectedProvider}
            onClick={() => void handleFinish()}
            type="button"
          >
            {testResult && !testResult.ok ? "Finish setup anyway →" : "Finish setup ✓"}
          </button>
        </Box>
      </Stack>
    );
  }

  // Step 0 (legal gate) uses full window — no centered card
  if (step === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          overflow: "auto",
          background: "var(--bg-primary)",
          px: { xs: 3, md: 5 },
          py: { xs: 3, md: 4 },
        }}
      >
        {content}
      </Box>
    );
  }

  return renderFrame(content);
}
