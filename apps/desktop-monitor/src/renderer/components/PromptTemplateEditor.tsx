import { useEffect, useRef, useState } from "react";

type Props = {
  kind: "summary" | "urgent";
  title: string;
  description: string;
  flowSteps: string[];
  variables: Array<{ name: string; label: string }>;
  template: string;
  isCustom: boolean;
  defaultTemplate: string;
  onSave: (template: string) => void;
  onReset: () => void;
  onPreview: () => void;
};

export function PromptTemplateEditor({
  kind: _kind,
  title,
  description,
  flowSteps,
  variables,
  template,
  isCustom,
  defaultTemplate,
  onSave,
  onReset,
  onPreview,
}: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(template);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(template);
  }, [template]);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
  }, []);

  function flashSaved(): void {
    setSaved(true);
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaved(false);
      saveTimerRef.current = null;
    }, 1600);
  }

  function insertVariable(variableName: string): void {
    const textarea = textareaRef.current;
    const token = `{{${variableName}}}`;

    if (!textarea) {
      setDraft((current) => `${current}${token}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextDraft = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    setDraft(nextDraft);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.selectionStart = caret;
      textarea.selectionEnd = caret;
    });
  }

  async function handleSave(): Promise<void> {
    await Promise.resolve(onSave(draft));
    flashSaved();
  }

  async function handleReset(): Promise<void> {
    setDraft(defaultTemplate);
    await Promise.resolve(onReset());
    setSaved(false);
  }

  return (
    <div className="template-section">
      <button
        className="template-header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <svg
          className={`expand-icon${expanded ? " open" : ""}`}
          fill="none"
          viewBox="0 0 16 16"
        >
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="template-title">{title}</span>
        <span className={`template-badge ${isCustom ? "custom" : "default"}`}>
          {isCustom ? "Custom" : "Default"}
        </span>
      </button>

      {expanded ? (
        <div className="template-body">
          <p className="template-desc">{description}</p>

          <div className="template-flow">
            {flowSteps.map((step, index) => (
              <div className="flow-step" key={step}>
                <span>{step}</span>
                {index < flowSteps.length - 1 ? <span className="flow-arrow">→</span> : null}
              </div>
            ))}
          </div>

          <p className="var-chip-label">Click to insert variable:</p>
          <div className="var-chips">
            {variables.map((variable) => (
              <button
                className="var-chip"
                key={variable.name}
                onClick={() => insertVariable(variable.name)}
                type="button"
              >
                {variable.label}
              </button>
            ))}
          </div>

          <textarea
            className="template-editor"
            onChange={(event) => setDraft(event.target.value)}
            ref={textareaRef}
            spellCheck={false}
            value={draft}
          />

          <div className="template-actions">
            <button className="dashboard-button soft sm" onClick={onPreview} type="button">
              Preview with sample data
            </button>
            <button className="btn-ghost" onClick={() => void handleReset()} type="button">
              Reset to default
            </button>
            <span style={{ flex: 1 }} />
            <button className="dashboard-button sm" onClick={() => void handleSave()} type="button">
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
