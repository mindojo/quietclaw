import { Box, Stack, Typography } from "@mui/material";

type DaemonStatusProps = {
  lastUpdateAt: number | null;
  port: number;
  telegramReady: boolean;
};

export function DaemonStatus({
  lastUpdateAt,
  port,
  telegramReady,
}: DaemonStatusProps): JSX.Element {
  const ageMs = lastUpdateAt === null ? null : Date.now() - lastUpdateAt;
  const color = lastUpdateAt === null
    ? "grey.500"
    : ageMs !== null && ageMs < 5 * 60 * 1000
      ? "success.main"
      : "warning.main";

  return (
    <Stack alignItems="center" direction="row" spacing={1.25}>
      <Box
        sx={{
          bgcolor: telegramReady ? color : "grey.500",
          borderRadius: "50%",
          height: 10,
          width: 10,
        }}
      />
      <Stack spacing={0.2}>
        <Typography variant="body2">Listening on port {port}</Typography>
        <Typography color="text.secondary" variant="caption">
          {lastUpdateAt === null
            ? "Waiting for messages..."
            : `Last update: ${formatAge(ageMs ?? 0)} ago`}
        </Typography>
      </Stack>
    </Stack>
  );
}

function formatAge(ageMs: number): string {
  const minutes = Math.max(0, Math.floor(ageMs / 60000));
  if (minutes < 1) {
    return "<1m";
  }

  return `${minutes}m`;
}
