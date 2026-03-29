import { useMutation } from "@tanstack/react-query";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { LEGAL_BUNDLE_VERSION } from "../../shared/legalConstants";
import { monitorAppClient } from "../api/ipcClient";

type LegalGateProps = {
  onAccepted(): void;
};

export function LegalGate({ onAccepted }: LegalGateProps): JSX.Element {
  const [accepted, setAccepted] = useState(false);
  const acceptMutation = useMutation({
    mutationFn: () => monitorAppClient.acceptLegal({
      legalBundleVersion: LEGAL_BUNDLE_VERSION,
      appVersion: null,
      acceptedAt: new Date().toISOString(),
      locale: navigator.language ?? null,
      platform: navigator.platform ?? null,
      docs: {
        termsVersion: LEGAL_BUNDLE_VERSION,
        privacyVersion: LEGAL_BUNDLE_VERSION,
        riskDisclosureVersion: LEGAL_BUNDLE_VERSION,
        retentionNoticeVersion: LEGAL_BUNDLE_VERSION,
      },
      requiredChecks: {
        acceptedTerms: true,
        acknowledgedPrivacy: true,
        acknowledgedRisk: true,
        acknowledgedRetentionCaveat: true,
      },
      optionalChoices: {
        analyticsOptIn: false,
        crashPrepOptIn: false,
      },
      providerConsents: [],
    }),
    onSuccess: () => {
      onAccepted();
    },
  });

  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "grid",
        placeItems: "center",
        p: 3,
      }}
    >
      <Paper
        sx={{
          maxWidth: 820,
          p: { xs: 3, md: 5 },
          width: "100%",
        }}
        variant="outlined"
      >
        <Stack spacing={3}>
          <Stack spacing={1.25}>
            <Typography variant="h4">QuietClaw Desktop Monitor</Typography>
            <Typography color="text.secondary" variant="body1">
              Review these terms before using the desktop shell.
            </Typography>
          </Stack>

          <Stack spacing={1.25}>
            <Typography variant="body2">
              This app is for educational and experimental use.
            </Typography>
            <Typography variant="body2">
              You are responsible for how monitoring, summaries, and urgent forwards are used.
            </Typography>
            <Typography variant="body2">
              The local gateway may expose sensitive local transport data on your machine.
            </Typography>
            <Typography variant="body2">
              This app can forward urgent messages and summaries into a target group.
            </Typography>
            <Typography variant="body2">
              You must ensure you have the right to monitor, summarize, or forward those messages.
            </Typography>
            <Typography variant="body2">
              The app only sees groups the gateway exposes, and some groups may be missing.
            </Typography>
            <Typography variant="body2">
              This app does not guarantee completeness, delivery, or privacy.
            </Typography>
          </Stack>

          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
            }
            label="I understand and accept"
          />

          <Button
            disabled={!accepted || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            size="large"
            variant="contained"
          >
            Continue
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
