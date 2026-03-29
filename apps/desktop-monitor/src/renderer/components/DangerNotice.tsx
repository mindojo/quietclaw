import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Alert, AlertTitle } from "@mui/material";
import type { ReactNode } from "react";

type DangerNoticeProps = {
  title: string;
  children: ReactNode;
};

export function DangerNotice({
  title,
  children,
}: DangerNoticeProps): JSX.Element {
  return (
    <Alert icon={<WarningAmberRoundedIcon fontSize="inherit" />} severity="warning">
      <AlertTitle>{title}</AlertTitle>
      {children}
    </Alert>
  );
}
