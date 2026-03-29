import { DateTime } from "luxon";
import type { GatewayGroup, GroupsResponse } from "@quietclaw/gateway-contract";
import { Typography } from "@mui/material";

import type { DesktopMonitorWatchedGroup } from "../../preload/api";
import { EmptyState } from "./EmptyState";
import "./Dashboard.css";

type WatchedField = "dailySummary" | "forwardUrgent";

type GroupListProps = {
  disabled: boolean;
  groups: GroupsResponse | null;
  hidingGroupIds: string[];
  onHideGroup(groupId: string): void;
  watchedGroups: DesktopMonitorWatchedGroup[];
  onToggleColumn(field: WatchedField, value: boolean): void;
  onToggleGroup(groupId: string, field: WatchedField, value: boolean): void;
};

type GroupRow = {
  dailySummary: boolean;
  forwardUrgent: boolean;
  groupId: string;
  group: GatewayGroup | null;
  name: string;
  stale: boolean;
};

export function GroupList({
  disabled,
  groups,
  hidingGroupIds: _hidingGroupIds,
  onHideGroup: _onHideGroup,
  watchedGroups,
  onToggleColumn: _onToggleColumn,
  onToggleGroup,
}: GroupListProps): JSX.Element {
  const availableGroups = groups?.groups ?? [];
  const watchedGroupsById = new Map(watchedGroups.map((entry) => [entry.groupId, entry]));
  const staleRows = watchedGroups
    .filter((entry) => !availableGroups.some((group) => group.id === entry.groupId))
    .map<GroupRow>((entry) => ({
      groupId: entry.groupId,
      group: null,
      name: entry.groupId,
      stale: true,
      dailySummary: entry.dailySummary,
      forwardUrgent: entry.forwardUrgent,
    }));
  const rows = availableGroups
    .map<GroupRow>((group) => ({
      groupId: group.id,
      group,
      name: group.name,
      stale: false,
      dailySummary: watchedGroupsById.get(group.id)?.dailySummary ?? false,
      forwardUrgent: watchedGroupsById.get(group.id)?.forwardUrgent ?? false,
    }))
    .concat(staleRows);
  const selectedSummaryCount = rows.filter((entry) => entry.dailySummary).length;
  const selectedUrgentCount = rows.filter((entry) => entry.forwardUrgent).length;

  return (
    <div className="dashboard-card group-list-card">
      <div className="group-list-header">
        <Typography className="group-list-title" component="h2">
          Watched groups
        </Typography>
        <Typography className="group-list-summary">
          {rows.length} groups · {selectedSummaryCount} with summaries · {selectedUrgentCount} with urgent
          {disabled ? " · summaries paused" : ""}
        </Typography>
      </div>

      <div
        className={`group-list-scroll${disabled ? " group-list-disabled" : ""}`}
        style={disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}
      >
        {rows.length === 0 ? (
          <EmptyState
            description="Groups will appear here automatically as messages come in through connected sources."
            title="Listening for messages..."
          />
        ) : (
          rows.map((row) => (
            <div className={`group-row${row.stale ? " stale" : ""}`} key={row.groupId}>
              <div
                className="group-avatar"
                style={{ background: colorForGroup(row.name) }}
              >
                {getAvatarLabel(row.name)}
              </div>

              <div className="group-meta">
                <div className="group-name-row">
                  <Typography className="group-name">{row.name}</Typography>
                  <span className="source-badge">
                    {row.stale ? "Unavailable" : getSourceBadgeLabel(row.group)}
                  </span>
                </div>
                <Typography className="group-stats">
                  {buildGroupStats(row.group, row.stale)}
                </Typography>
              </div>

              <div className="group-controls">
                <div className="toggle-block">
                  <span className="toggle-label">Summary</span>
                  <button
                    aria-label={`Toggle summary for ${row.name}`}
                    className={`toggle-switch${row.dailySummary ? " on" : ""}`}
                    disabled={disabled}
                    onClick={() => onToggleGroup(row.groupId, "dailySummary", !row.dailySummary)}
                    type="button"
                  />
                </div>
                <div className="toggle-block">
                  <span className="toggle-label">Urgent</span>
                  <button
                    aria-label={`Toggle urgent for ${row.name}`}
                    className={`toggle-switch${row.forwardUrgent ? " on" : ""}`}
                    disabled={disabled}
                    onClick={() => onToggleGroup(row.groupId, "forwardUrgent", !row.forwardUrgent)}
                    type="button"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getAvatarLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
}

function colorForGroup(name: string): string {
  const palette = ["#3a6b35", "#5d7f92", "#c06c4e", "#8a5d9f", "#4c8b7a", "#ba8d3b"] as const;
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length] ?? "#3a6b35";
}

function getSourceBadgeLabel(group: GatewayGroup | null): string {
  if (!group) {
    return "Simulator";
  }

  const note = group.notes.find((entry) => /^source:/i.test(entry));
  return note ? note.split(":").slice(1).join(":").trim() || "Simulator" : "Simulator";
}

function buildGroupStats(group: GatewayGroup | null, stale: boolean): string {
  if (stale || !group) {
    return "Unavailable · previously watched";
  }

  return [
    `${group.messageCount24h} messages`,
    group.lastMessageAt ? `last ${formatRelativeTime(group.lastMessageAt)} ago` : "waiting for first message",
  ].join(" · ");
}

function formatRelativeTime(value: string): string {
  const dateTime = DateTime.fromISO(value);
  if (!dateTime.isValid) {
    return "just now";
  }

  const elapsedMinutes = Math.max(0, (Date.now() - dateTime.toMillis()) / 60000);
  if (elapsedMinutes < 1) {
    return "<1m";
  }
  if (elapsedMinutes < 60) {
    return `${Math.floor(elapsedMinutes)}m`;
  }
  const elapsedHours = elapsedMinutes / 60;
  if (elapsedHours < 24) {
    return `${Math.floor(elapsedHours)}h`;
  }
  return `${Math.floor(elapsedHours / 24)}d`;
}
