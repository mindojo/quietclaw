import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { ActivityEntry, ActivityKind } from "../../preload/api";

type ActivityListProps = {
  activity: ActivityEntry[];
};

const KIND_META: Record<ActivityKind, { label: string; color: "default" | "success" | "warning" | "error" | "info" }> = {
  daemon_started: { label: "Daemon", color: "success" },
  telegram_ready: { label: "Telegram", color: "success" },
  telegram_blocked: { label: "Telegram", color: "warning" },
  gateway_connected: { label: "Gateway", color: "success" },
  gateway_disconnected: { label: "Gateway", color: "warning" },
  gateway_backfilling: { label: "Gateway", color: "info" },
  gateway_pairing_required: { label: "Gateway", color: "warning" },
  monitor_saved: { label: "Config", color: "info" },
  urgent_detected: { label: "Urgent", color: "warning" },
  urgent_skipped: { label: "Urgent", color: "default" },
  urgent_blocked: { label: "Urgent", color: "error" },
  urgent_queued: { label: "Urgent", color: "success" },
  digest_started: { label: "Digest", color: "info" },
  digest_blocked: { label: "Digest", color: "error" },
  digest_queued: { label: "Digest", color: "success" },
  digest_empty: { label: "Digest", color: "default" },
  runner_unavailable: { label: "Runner", color: "warning" },
  membership_blocked: { label: "Safety", color: "error" },
  manual_test_sent: { label: "Manual", color: "success" },
};

export function ActivityList({ activity }: ActivityListProps): JSX.Element {
  const recentEntries = activity.slice(0, 12);

  return (
    <Paper sx={{ overflow: "hidden" }} variant="outlined">
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        px={2}
        py={1.5}
      >
        <Typography variant="subtitle2">Recent Activity</Typography>
        <Typography color="text.secondary" variant="caption">
          Last {recentEntries.length || 0} entries
        </Typography>
      </Stack>
      <Divider />
      {recentEntries.length === 0 ? (
        <Box px={2} py={2.5}>
          <Typography color="text.secondary" variant="body2">
            No monitor activity yet. Queued, blocked, and skipped events will appear here.
          </Typography>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {recentEntries.map((entry) => {
            const meta = KIND_META[entry.kind];

            return (
              <Stack key={entry.id} px={2} py={1.5} spacing={0.75}>
                <Stack
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Stack
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                  >
                    <Chip color={meta.color} label={meta.label} size="small" variant="outlined" />
                    <Typography variant="body2">{entry.summary}</Typography>
                  </Stack>
                  <Typography color="text.secondary" variant="caption">
                    {formatActivityTime(entry.ts)}
                  </Typography>
                </Stack>
                {entry.detail ? (
                  <Typography color="text.secondary" variant="caption">
                    {entry.detail}
                  </Typography>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

function formatActivityTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
