import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { TelegramStatus } from "../../preload/api";

type TelegramSetupProps = {
  pending: boolean;
  status: TelegramStatus;
  tokenDraft: string;
  onTokenDraftChange(value: string): void;
  onVerify(): void;
};

export function TelegramSetup({
  pending,
  status,
  tokenDraft,
  onTokenDraftChange,
  onVerify,
}: TelegramSetupProps): JSX.Element {
  if (status.onboardingState === "ready") {
    return (
      <Alert severity="success">
        Connected as @{status.botUsername}. Telegram delivery is ready.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Telegram Bot</Typography>
      {status.onboardingState === "not_configured" ? (
        <>
          <Typography color="text.secondary" variant="body2">
            Create a bot with BotFather, paste the bot token here, then verify it.
          </Typography>
          <TextField
            label="Bot Token"
            onChange={(event) => onTokenDraftChange(event.target.value)}
            type="password"
            value={tokenDraft}
          />
          <Button
            disabled={pending || tokenDraft.trim().length === 0}
            onClick={onVerify}
            variant="contained"
          >
            {pending ? "Verifying..." : "Verify"}
          </Button>
        </>
      ) : null}

      {status.onboardingState !== "not_configured" && status.botUsername ? (
        <Stack spacing={1.25}>
          <Alert severity="info">Verified bot @{status.botUsername}.</Alert>
          <Box>
            <Link href={`https://t.me/${status.botUsername}`} rel="noreferrer" target="_blank">
              Open @{status.botUsername} in Telegram
            </Link>
          </Box>
          <Stack alignItems="center" direction="row" spacing={1}>
            <CircularProgress size={18} />
            <Typography variant="body2">Waiting for you to send /start...</Typography>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
