import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";

import type { RunnerStatus } from "../../preload/api";

type RunnerStatusCardProps = {
  disabled?: boolean;
  onSelect(): void;
  runner: RunnerStatus;
};

export function RunnerStatusCard({
  disabled = false,
  onSelect,
  runner,
}: RunnerStatusCardProps): JSX.Element {
  return (
    <Card
      sx={{
        border: "1px solid",
        borderColor: runner.selected ? "primary.main" : "divider",
        boxShadow: runner.selected ? "0 0 0 2px rgba(25, 118, 210, 0.12)" : "none",
        flex: 1,
        minWidth: 0,
      }}
      variant="outlined"
    >
      <CardActionArea disabled={disabled} onClick={onSelect}>
        <CardContent>
          <Stack spacing={1.25}>
            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="subtitle1">{runner.label}</Typography>
              <Stack alignItems="center" direction="row" spacing={0.75}>
                <Typography color={runner.available ? "success.main" : "text.secondary"} variant="caption">
                  {runner.available ? "Available" : "Not found"}
                </Typography>
                <Typography
                  aria-hidden
                  sx={{
                    bgcolor: runner.available ? "success.main" : "grey.500",
                    borderRadius: "50%",
                    display: "block",
                    flexShrink: 0,
                    height: 10,
                    width: 10,
                  }}
                />
              </Stack>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              {runner.detail ?? "No detail available."}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
