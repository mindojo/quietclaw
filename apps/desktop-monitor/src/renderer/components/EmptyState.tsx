import { Typography } from "@mui/material";

import "./Dashboard.css";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({
  title,
  description,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-pulse">
        <div className="status-dot connected" />
      </div>
      <Typography className="empty-title" component="h2">
        {title}
      </Typography>
      <Typography className="empty-description">
        {description}
      </Typography>
    </div>
  );
}
