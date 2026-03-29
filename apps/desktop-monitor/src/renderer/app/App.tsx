import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  CircularProgress,
  Snackbar,
  Stack,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { CssBaseline } from "@mui/material";
import { DateTime } from "luxon";
import { useEffect, useRef, useState } from "react";

import type {
  ActivityEntry,
  DesktopMonitorUpsert,
  LegalAcceptanceRecord,
  SaveSettingsInput,
  TelegramStatus,
} from "../../preload/api";
import { isCurrentLegalAcceptance } from "../../shared/legalConstants";
import { monitorAppClient } from "../api/ipcClient";
import {
  queryKeys,
  useDaemonStatusQuery,
  useGroupsQuery,
  useMonitorQuery,
  useTelegramStatusQuery,
} from "../api/queries";
import { Layout } from "../components/Layout";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { SettingsDialog } from "../components/SettingsDialog";
import { MainPage } from "../pages/MainPage";
import { useAppStore } from "../state/appStore";
import { queryClient } from "./providers";
import { appTheme } from "./theme";

const appQueryKeys = {
  activity: ["activity"] as const,
  bootstrap: ["bootstrap"] as const,
  runnerStatus: ["runnerStatus"] as const,
  settings: ["settings"] as const,
};

function serializeMonitorDraft(input: DesktopMonitorUpsert): string {
  return JSON.stringify({
    ...input,
    watchedGroups: [...input.watchedGroups].sort((left, right) =>
      left.groupId.localeCompare(right.groupId),
    ),
  });
}

function telegramQueryFallback(data: TelegramStatus | undefined): TelegramStatus {
  return data ?? {
    onboardingState: "not_configured",
    botUsername: null,
    chatId: null,
    lastVerifiedAt: null,
  };
}

export function App(): JSX.Element {
  const [hidingGroupIds, setHidingGroupIds] = useState<string[]>([]);
  const lastAppliedMonitorKey = useRef<string | null>(null);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const telegramTokenDraft = useAppStore((state) => state.telegramTokenDraft);
  const setTelegramTokenDraft = useAppStore((state) => state.setTelegramTokenDraft);
  const replaceMonitorDraft = useAppStore((state) => state.replaceMonitorDraft);
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);
  const pushToast = useAppStore((state) => state.pushToast);

  const bootstrapQuery = useQuery({
    queryKey: appQueryKeys.bootstrap,
    queryFn: () => monitorAppClient.getBootstrapState(),
  });

  const settingsQuery = useQuery({
    queryKey: appQueryKeys.settings,
    queryFn: () => monitorAppClient.getSettings(),
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.settings,
  });

  const monitorQuery = useMonitorQuery({
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.monitor,
  });

  const telegramStatusQuery = useTelegramStatusQuery({
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.telegramStatus,
  });

  const daemonStatusQuery = useDaemonStatusQuery({
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.daemonStatus,
  });

  const groupsQuery = useGroupsQuery({
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.groups,
  });

  const activityQuery = useQuery({
    queryKey: appQueryKeys.activity,
    queryFn: () => monitorAppClient.getActivity(),
    enabled: bootstrapQuery.isSuccess,
    initialData: bootstrapQuery.data?.activity,
  });

  const runnerStatusQuery = useQuery({
    queryKey: appQueryKeys.runnerStatus,
    queryFn: () => monitorAppClient.getRunnerStatus(),
    enabled: bootstrapQuery.isSuccess,
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) {
      return;
    }

    setSettingsOpen(settings.ui.settingsOpen);
  }, [setSettingsOpen, settingsQuery.data]);

  useEffect(() => {
    const monitor = monitorQuery.data;
    if (!monitor) {
      return;
    }

    const nextMonitorKey = serializeMonitorDraft(monitor);
    if (lastAppliedMonitorKey.current === nextMonitorKey) {
      return;
    }

    replaceMonitorDraft(monitor);
    lastAppliedMonitorKey.current = nextMonitorKey;
  }, [monitorQuery.data, replaceMonitorDraft]);

  useEffect(() => {
    const visibleGroupIds = new Set([
      ...((groupsQuery.data?.groups ?? []).map((group) => group.id)),
      ...((monitorQuery.data?.watchedGroups ?? []).map((entry) => entry.groupId)),
    ]);

    setHidingGroupIds((current) => current.filter((groupId) => visibleGroupIds.has(groupId)));
  }, [groupsQuery.data, monitorQuery.data]);

  useEffect(() => {
    return monitorAppClient.subscribe((event) => {
      switch (event.type) {
        case "activity-appended":
          queryClient.setQueryData(appQueryKeys.activity, (current: ActivityEntry[] | undefined) => {
            const existingEntries = current ?? [];
            return [event.entry, ...existingEntries].slice(0, 1000);
          });
          break;
        case "bootstrap-changed":
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.bootstrap });
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.settings });
          break;
        case "daemon-status-changed":
          queryClient.setQueryData(queryKeys.daemonStatus, event.status);
          break;
        case "group-catalog-updated":
          queryClient.setQueryData(queryKeys.groups, event.groups);
          break;
        case "monitor-changed":
          void queryClient.invalidateQueries({ queryKey: queryKeys.monitor });
          break;
        case "settings-changed":
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.settings });
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.runnerStatus });
          break;
        case "telegram-status-changed":
          queryClient.setQueryData(queryKeys.telegramStatus, event.status);
          break;
      }
    });
  }, []);

  const saveSettingsMutation = useMutation({
    mutationFn: (input: SaveSettingsInput) => monitorAppClient.saveSettings(input),
  });

  const acceptLegalMutation = useMutation({
    mutationFn: (record: LegalAcceptanceRecord) => monitorAppClient.acceptLegal(record),
  });

  const clearActivityMutation = useMutation({
    mutationFn: () => monitorAppClient.clearActivity(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.activity });
      pushToast({
        message: "Activity log cleared.",
        severity: "success",
      });
    },
  });

  const checkForUpdatesMutation = useMutation({
    mutationFn: () => monitorAppClient.checkForUpdates(),
    onSuccess: (result) => {
      pushToast({
        message: result.detail,
        severity: result.status === "error"
          ? "error"
          : result.status === "update-available" || result.status === "update-downloaded"
            ? "warning"
            : "info",
      });
    },
  });

  const exportDiagnosticsMutation = useMutation({
    mutationFn: () => monitorAppClient.exportDiagnostics(),
    onSuccess: (result) => {
      pushToast({
        message: result.saved && result.path ? `${result.detail} ${result.path}` : result.detail,
        severity: result.saved ? "success" : "info",
      });
    },
    onError: (error) => {
      pushToast({
        message: error instanceof Error ? error.message : "Diagnostics export failed.",
        severity: "error",
      });
    },
  });

  const saveMonitorMutation = useMutation({
    mutationFn: (input: DesktopMonitorUpsert) => monitorAppClient.saveMonitor(input),
    onError: (error) => {
      pushToast({
        message: error instanceof Error ? error.message : "Monitor save failed.",
        severity: "error",
      });
    },
  });

  const hideGroupMutation = useMutation({
    mutationFn: (groupId: string) => monitorAppClient.hideGroup(groupId),
    onMutate: (groupId) => {
      setHidingGroupIds((current) =>
        current.includes(groupId) ? current : [...current, groupId]
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitor });
    },
    onError: (error, groupId) => {
      setHidingGroupIds((current) =>
        current.filter((currentGroupId) => currentGroupId !== groupId)
      );
      pushToast({
        message: error instanceof Error ? error.message : "Failed to hide the group.",
        severity: "error",
      });
    },
  });

  const sendTestSummaryMutation = useMutation({
    mutationFn: () => monitorAppClient.sendTestSummary(),
    onSuccess: (result) => {
      pushToast({
        message: result.detail,
        severity: result.ok ? "success" : result.blocked ? "warning" : "error",
      });
    },
  });

  const sendTestMessageMutation = useMutation({
    mutationFn: () => monitorAppClient.sendTestTelegramMessage(),
    onSuccess: (result) => {
      pushToast({
        message: result.detail,
        severity: result.ok ? "success" : "error",
      });
    },
    onError: (error) => {
      pushToast({
        message: error instanceof Error ? error.message : "Failed to send test message.",
        severity: "error",
      });
    },
  });

  const setTelegramTokenMutation = useMutation({
    mutationFn: (token: string) => monitorAppClient.setTelegramBotToken(token),
    onSuccess: (result) => {
      if (result.ok) {
        setTelegramTokenDraft("");
        pushToast({
          message: "Telegram bot verified. Send /start to complete setup.",
          severity: "success",
        });
        return;
      }

      pushToast({
        message: result.error ?? "Telegram bot verification failed.",
        severity: "error",
      });
    },
    onError: (error) => {
      pushToast({
        message: error instanceof Error ? error.message : "Telegram bot verification failed.",
        severity: "error",
      });
    },
  });

  const settings = settingsQuery.data;
  const monitor = monitorQuery.data;
  const daemonStatus = daemonStatusQuery.data;
  const telegramStatus = telegramStatusQuery.data;
  const runnerStatus = runnerStatusQuery.data ?? [];
  const telegramReady = telegramStatus?.onboardingState === "ready";
  const legalAccepted = bootstrapQuery.data
    ? isCurrentLegalAcceptance(bootstrapQuery.data.legal)
    : false;
  const updateBannerOpen = settings
    ? settings.updates.status === "update-available" ||
      settings.updates.status === "update-downloaded"
    : false;
  const isOnboardingComplete = legalAccepted &&
    telegramStatusQuery.data?.onboardingState === "ready";
  function handleSettingsOpen(open: boolean): void {
    setSettingsOpen(open);
    void saveSettingsMutation.mutateAsync({ settingsOpen: open }).catch(() => {
      pushToast({
        message: "Failed to persist settings dialog state.",
        severity: "error",
      });
    });
  }

  if (bootstrapQuery.isPending || !settings || !monitor || !daemonStatus || !telegramStatus) {
    if (bootstrapQuery.isError) {
      return (
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
          <Box sx={{ display: "grid", placeItems: "center", height: "100%", p: 3 }}>
            <Alert severity="error" sx={{ maxWidth: 640 }}>
              {bootstrapQuery.error instanceof Error
                ? bootstrapQuery.error.message
                : "Failed to load the desktop app."}
            </Alert>
          </Box>
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />
            <Typography color="text.secondary" variant="body2">
              Loading desktop shell...
            </Typography>
          </Stack>
        </Box>
      </ThemeProvider>
    );
  }

  if (!isOnboardingComplete && bootstrapQuery.isSuccess) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <OnboardingWizard
          appVersion={settings.appVersion}
          legal={bootstrapQuery.data.legal}
          legalAccepted={legalAccepted}
          onComplete={() => {
            void queryClient.invalidateQueries();
          }}
          onLegalAccepted={(record) => acceptLegalMutation.mutate(record)}
          onTelegramTokenSet={async (token) => {
            const result = await monitorAppClient.setTelegramBotToken(token);
            if (result.ok) {
              await queryClient.invalidateQueries({ queryKey: queryKeys.telegramStatus });
            }
            return result;
          }}
          telegramStatus={telegramQueryFallback(telegramStatusQuery.data)}
        />
      </ThemeProvider>
    );
  }

  const nextSummaryTime = DateTime.now()
    .setZone(monitor.digestTimezone)
    .set({
      hour: Number(monitor.digestTimeLocal.split(":")[0] ?? "20"),
      minute: Number(monitor.digestTimeLocal.split(":")[1] ?? "30"),
      second: 0,
      millisecond: 0,
    })
    .toFormat("HH:mm");

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Layout
        daemonPort={daemonStatus.port}
        engineLabel="Claude Code · Haiku"
        lastUpdateAt={daemonStatus.lastUpdateAt}
        nextSummaryTime={nextSummaryTime}
        onOpenSettings={() => handleSettingsOpen(true)}
        onRetryConnection={() => {
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.bootstrap });
          void queryClient.invalidateQueries({ queryKey: queryKeys.telegramStatus });
          void queryClient.invalidateQueries({ queryKey: queryKeys.daemonStatus });
          void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
        }}
        settingsActive={settingsOpen}
        telegramReady={Boolean(telegramReady)}
        {...(!telegramReady
          ? {
              errorMessage:
                "Telegram is disconnected. Monitoring actions stay paused until setup is completed again.",
            }
          : {})}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateRows: updateBannerOpen ? "auto auto 1fr" : "auto 1fr",
            height: "100%",
            minHeight: 0,
            gap: 1.5,
          }}
        >
          {updateBannerOpen ? (
            <Alert
              severity="info"
              sx={{ borderRadius: "var(--radius-lg)" }}
              variant="outlined"
            >
              {settings.updates.detail}
            </Alert>
          ) : null}
          {settingsOpen ? (
            <SettingsDialog
              checkForUpdatesPending={checkForUpdatesMutation.isPending}
              clearActivityPending={clearActivityMutation.isPending}
              exportDiagnosticsPending={exportDiagnosticsMutation.isPending}
              onCheckForUpdates={() => checkForUpdatesMutation.mutate()}
              onClearActivity={() => clearActivityMutation.mutate()}
              onClose={() => handleSettingsOpen(false)}
              onExportDiagnostics={() => exportDiagnosticsMutation.mutate()}
              onOpenLegal={(documentId) => {
                void monitorAppClient.openLegalDocument(documentId);
              }}
              onSaveSettings={(input) => saveSettingsMutation.mutate(input)}
              onTelegramTokenDraftChange={setTelegramTokenDraft}
              onVerifyTelegram={() => setTelegramTokenMutation.mutate(telegramTokenDraft)}
              open
              runnerStatus={runnerStatus}
              saveSettingsPending={saveSettingsMutation.isPending}
              settings={settings}
              telegramPending={setTelegramTokenMutation.isPending}
              telegramStatus={telegramStatus}
              telegramTokenDraft={telegramTokenDraft}
            />
          ) : (
            <MainPage
              activity={activityQuery.data ?? []}
              demoControlsEnabled={false}
              demoPending={false}
              demoScenarios={[]}
              groups={groupsQuery.data ?? null}
              hidingGroupIds={hidingGroupIds}
              monitor={monitor}
              onHideGroup={(groupId) => hideGroupMutation.mutate(groupId)}
              onOpenSettings={() => handleSettingsOpen(true)}
              onResetDemo={() => undefined}
              onRunDemoScenario={() => undefined}
              onSaveMonitor={(input) => saveMonitorMutation.mutate(input)}
              onSendTestMessage={() => sendTestMessageMutation.mutate()}
              onSendTestSummary={() => sendTestSummaryMutation.mutate()}
              savePending={saveMonitorMutation.isPending}
              sendTestMessagePending={sendTestMessageMutation.isPending}
              sendPending={sendTestSummaryMutation.isPending}
              telegramStatus={telegramStatus}
            />
          )}
        </Box>
      </Layout>

      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          autoHideDuration={5000}
          onClose={() => dismissToast(toast.id)}
          open
        >
          <Alert
            onClose={() => dismissToast(toast.id)}
            severity={toast.severity}
            sx={{ width: "100%" }}
            variant="filled"
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ThemeProvider>
  );
}
