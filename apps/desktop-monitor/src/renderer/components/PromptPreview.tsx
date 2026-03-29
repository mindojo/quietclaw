type PreviewProps = {
  template: string;
  onBack: () => void;
};

function renderTemplateWithHighlights(
  template: string,
  variables: Record<string, string>,
): Array<string | JSX.Element> {
  const result: Array<string | JSX.Element> = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  let cursor = 0;

  while ((match = regex.exec(template)) !== null) {
    if (match.index > cursor) {
      result.push(template.slice(cursor, match.index));
    }

    const key = match[1] ?? "";
    const value = variables[key];
    if (value === undefined) {
      result.push(match[0]);
    } else {
      result.push(
        <span className="var-highlight" key={`${key}-${match.index}`}>
          {value}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < template.length) {
    result.push(template.slice(cursor));
  }

  return result;
}

function renderPreviewContent(
  template: string,
  variables: Record<string, string>,
): JSX.Element {
  return (
    <div
      className="preview-content"
      style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}
    >
      {renderTemplateWithHighlights(template, variables)}
    </div>
  );
}

export function SummaryPreview({ template, onBack }: PreviewProps): JSX.Element {
  const familyVars = {
    group_name: "Family Chat",
    source: "WhatsApp",
    time_period: "24 hours",
    message_count: "142",
    messages: "[142 messages inserted here]",
  };
  const workVars = {
    group_name: "Work Team",
    source: "Telegram",
    time_period: "24 hours",
    message_count: "87",
    messages: "[87 messages inserted here]",
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <button className="settings-back" onClick={onBack} type="button">
          <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to settings
        </button>
        <span className="settings-title">Summary preview</span>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        Preview how your daily summary prompt is assembled and what the final Telegram
        message looks like using sample data.
      </p>

      <p className="settings-label">Step 1: Prompt sent per group</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        Each group with messages gets its own AI call. Groups with no messages are skipped entirely.
      </p>

      <div className="preview-box" style={{ marginBottom: 12 }}>
        <div className="preview-header">
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Family Chat</span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-secondary)",
              color: "var(--text-tertiary)",
            }}
          >
            WhatsApp
          </span>
          <span style={{ marginLeft: "auto", color: "var(--green)", fontWeight: 500 }}>
            142 messages
          </span>
        </div>
        {renderPreviewContent(template, familyVars)}
      </div>

      <div className="preview-box" style={{ marginBottom: 12 }}>
        <div className="preview-header">
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Work Team</span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-secondary)",
              color: "var(--text-tertiary)",
            }}
          >
            Telegram
          </span>
          <span style={{ marginLeft: "auto", color: "var(--green)", fontWeight: 500 }}>
            87 messages
          </span>
        </div>
        {renderPreviewContent(template, workVars)}
      </div>

      <div className="preview-box" style={{ marginBottom: "1.25rem" }}>
        <div className="preview-header">
          <span
            style={{
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textDecoration: "line-through",
            }}
          >
            Parents Committee
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-secondary)",
              color: "var(--text-tertiary)",
            }}
          >
            WhatsApp
          </span>
          <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
            0 messages - skipped
          </span>
        </div>
      </div>

      <p className="settings-label">Step 2: Assembled Telegram message</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        All non-empty group summaries are stacked into a single message with group headers.
      </p>

      <div className="output-preview">
        <div className="output-header">Message sent to your Telegram</div>
        <div className="output-content">
          <div className="output-msg">
            <p style={{ fontWeight: 500, margin: "0 0 8px", fontSize: 14 }}>Daily Summary - March 28</p>
            <p style={{ fontWeight: 500, margin: "12px 0 4px", fontSize: 13 }}>Family Chat (WhatsApp)</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • Mom shared photos from the weekend trip to Eilat
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • Dad asked about Passover dinner plans and Aunt Sara still has not replied
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • Reminder: dentist appointment for the kids on Thursday at 10am
            </p>
            <p style={{ fontWeight: 500, margin: "16px 0 4px", fontSize: 13 }}>Work Team (Telegram)</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • Sprint retro moved to Wednesday at 3pm
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • API rate limiting bug was fixed and deployed to staging
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              • Action: review PR #247 before end of day tomorrow
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                margin: "12px 0 0",
                fontStyle: "italic",
              }}
            >
              Parents Committee - no updates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UrgentPreview({ template, onBack }: PreviewProps): JSX.Element {
  const urgentVars = {
    group_name: "Work Team",
    source: "Telegram",
    sender_name: "David",
    message_text: "@Alex the staging server is down and client demo is in 30 minutes. Can you check the deployment?",
  };
  const nonUrgentVars = {
    group_name: "Family Chat",
    source: "WhatsApp",
    sender_name: "Mom",
    message_text: "Just saw the cutest dog at the park! Reminds me of Benny",
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <button className="settings-back" onClick={onBack} type="button">
          <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to settings
        </button>
        <span className="settings-title">Urgent detection preview</span>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        Preview how the urgent detection prompt classifies different types of messages.
      </p>

      <div className="preview-box" style={{ marginBottom: 12 }}>
        <div className="preview-header">
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Sample message</span>
          <span style={{ marginLeft: "auto", fontWeight: 500, color: "var(--text-danger)" }}>
            Result: YES → forwarded
          </span>
        </div>
        {renderPreviewContent(template, urgentVars)}
      </div>

      <div className="output-preview" style={{ marginBottom: "1.25rem" }}>
        <div className="output-header">Forwarded to your Telegram immediately</div>
        <div className="output-content">
          <div className="output-msg">
            <p style={{ fontWeight: 500, margin: "0 0 4px", fontSize: 13, color: "var(--text-danger)" }}>
              Urgent - Work Team
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              <span style={{ fontWeight: 500 }}>David:</span>{" "}
              {urgentVars.message_text}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
              via Telegram · just now
            </p>
          </div>
        </div>
      </div>

      <div className="preview-box" style={{ marginBottom: 12 }}>
        <div className="preview-header">
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Sample message</span>
          <span style={{ marginLeft: "auto", fontWeight: 500, color: "var(--green)" }}>
            Result: NO → skipped
          </span>
        </div>
        {renderPreviewContent(template, nonUrgentVars)}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--bg-info)",
          borderRadius: "var(--radius)",
          fontSize: 13,
          color: "var(--text-info)",
          lineHeight: 1.5,
        }}
      >
        Urgent detection only runs on groups where the Urgent toggle is enabled. Messages in
        summary-only groups are never checked for urgency.
      </div>
    </div>
  );
}
