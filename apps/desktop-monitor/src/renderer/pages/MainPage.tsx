import { IANAZone } from "luxon";
import { Box } from "@mui/material";
import { useEffect, useMemo } from "react";
import type { DemoScenario, GroupsResponse } from "@quietclaw/gateway-contract";

import type {
  ActivityEntry,
  DesktopMonitorConfig,
  DesktopMonitorUpsert,
  TelegramStatus,
} from "../../preload/api";
import { GroupList } from "../components/GroupList";
import { MonitorConfig } from "../components/MonitorConfig";
import { useAppStore } from "../state/appStore";

type MainPageProps = {
  activity: ActivityEntry[];
  demoControlsEnabled: boolean;
  demoPending: boolean;
  demoScenarios: DemoScenario[];
  groups: GroupsResponse | null;
  hidingGroupIds: string[];
  monitor: DesktopMonitorConfig;
  savePending: boolean;
  sendTestMessagePending: boolean;
  sendPending: boolean;
  telegramStatus: TelegramStatus;
  onHideGroup(groupId: string): void;
  onOpenSettings(): void;
  onResetDemo(): void;
  onRunDemoScenario(id: string): void;
  onSaveMonitor(input: DesktopMonitorUpsert): void;
  onSendTestMessage(): void;
  onSendTestSummary(): void;
};

type WatchedField = "dailySummary" | "forwardUrgent";

function serializeMonitorConfig(input: DesktopMonitorUpsert): string {
  return JSON.stringify({
    ...input,
    watchedGroups: [...input.watchedGroups].sort((left, right) =>
      left.groupId.localeCompare(right.groupId),
    ),
  });
}

function getTimeZones(currentValue: string): string[] {
  const supported = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

  return supported.includes(currentValue) ? supported : [currentValue, ...supported];
}

function isValidDigestTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function MainPage({
  activity: _activity,
  demoControlsEnabled,
  demoPending,
  demoScenarios,
  groups,
  hidingGroupIds,
  monitor,
  savePending: _savePending,
  sendTestMessagePending,
  sendPending,
  telegramStatus,
  onHideGroup,
  onOpenSettings,
  onResetDemo,
  onRunDemoScenario,
  onSaveMonitor,
  onSendTestMessage,
  onSendTestSummary,
}: MainPageProps): JSX.Element {
  const draft = useAppStore((state) => state.monitorDraft);
  const updateMonitorDraft = useAppStore((state) => state.updateMonitorDraft);

  const catalogAvailable = groups !== null;
  const availableGroups = groups?.groups ?? [];
  const groupsById = useMemo(
    () => new Map(availableGroups.map((group) => [group.id, group])),
    [availableGroups],
  );
  const timezones = getTimeZones(draft?.digestTimezone ?? monitor.digestTimezone);
  const telegramReady = telegramStatus.onboardingState === "ready";
  const draftKey = JSON.stringify(draft?.watchedGroups);

  useEffect(() => {
    if (!draft || !telegramReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (serializeMonitorConfig(draft) !== serializeMonitorConfig(monitor)) {
        onSaveMonitor(draft);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, draftKey, monitor, onSaveMonitor, telegramReady]);

  if (!draft) {
    return <Box sx={{ height: "100%" }} />;
  }

  const dailySummarySelectedCount = draft.watchedGroups.filter((entry) => entry.dailySummary).length;
  const staleWatchedCount = draft.watchedGroups.filter(
    (entry) => catalogAvailable && !groupsById.has(entry.groupId),
  ).length;
  const hasInvalidDigestTime =
    dailySummarySelectedCount > 0 && !isValidDigestTime(draft.digestTimeLocal);
  const hasInvalidTimezone = !IANAZone.isValidZone(draft.digestTimezone);

  function updateWatchedGroup(groupId: string, field: WatchedField, value: boolean): void {
    updateMonitorDraft((current) => {
      const existing = current.watchedGroups.find((entry) => entry.groupId === groupId);
      const nextEntry = {
        groupId,
        dailySummary: existing?.dailySummary ?? false,
        forwardUrgent: existing?.forwardUrgent ?? false,
        [field]: value,
      };
      const remainingEntries = current.watchedGroups.filter((entry) => entry.groupId !== groupId);

      return {
        ...current,
        watchedGroups:
          nextEntry.dailySummary || nextEntry.forwardUrgent
            ? [...remainingEntries, nextEntry]
            : remainingEntries,
      };
    });
  }

  function toggleColumn(field: WatchedField, value: boolean): void {
    updateMonitorDraft((current) => {
      const existingEntries = new Map(current.watchedGroups.map((entry) => [entry.groupId, entry]));
      const nextEntries = availableGroups
        .map((group) => {
          const existing = existingEntries.get(group.id);
          const nextEntry = {
            groupId: group.id,
            dailySummary: field === "dailySummary" ? value : existing?.dailySummary ?? false,
            forwardUrgent: field === "forwardUrgent" ? value : existing?.forwardUrgent ?? false,
          };

          return nextEntry.dailySummary || nextEntry.forwardUrgent ? nextEntry : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      return {
        ...current,
        watchedGroups: nextEntries,
      };
    });
  }

  const totalMessages24h = availableGroups.reduce((sum, g) => sum + (g.messageCount24h ?? 0), 0);

  const sendTestDisabledReason = !telegramReady
    ? "Finish Telegram setup before sending a test summary."
    : groups === null
      ? "Waiting for group messages before a summary can be generated."
      : totalMessages24h === 0
        ? "Waiting for group messages before a summary can be generated."
        : dailySummarySelectedCount === 0
          ? "Select at least one daily summary group."
          : hasInvalidDigestTime
            ? "Enter a valid daily summary time."
            : hasInvalidTimezone
              ? "Select a valid IANA timezone."
              : null;

  return (
    <Box className="dashboard-main">
      <div style={!telegramReady ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
        <MonitorConfig
          dailySummarySelectedCount={dailySummarySelectedCount}
          demoControlsEnabled={demoControlsEnabled}
          demoPending={demoPending}
          demoScenarios={demoScenarios}
          digestTimeLocal={draft.digestTimeLocal}
          digestTimezone={draft.digestTimezone}
          onDigestTimeChange={(value) =>
            updateMonitorDraft((current) => ({
              ...current,
              digestTimeLocal: value,
            }))}
          onDigestTimezoneChange={(value) =>
            updateMonitorDraft((current) => ({
              ...current,
              digestTimezone: value,
            }))}
          onOpenSettings={onOpenSettings}
          onResetDemo={onResetDemo}
          onRunDemoScenario={onRunDemoScenario}
          onSendTestMessage={onSendTestMessage}
          onSendTestSummary={onSendTestSummary}
          sendPending={sendPending}
          sendTestDisabledReason={sendTestDisabledReason}
          sendTestMessagePending={sendTestMessagePending}
          telegramStatus={telegramStatus}
          timezoneOptions={timezones}
        />
      </div>

      <GroupList
        disabled={!telegramReady}
        groups={groups}
        hidingGroupIds={hidingGroupIds}
        onHideGroup={onHideGroup}
        onToggleColumn={toggleColumn}
        onToggleGroup={updateWatchedGroup}
        watchedGroups={draft.watchedGroups}
      />
    </Box>
  );
}
