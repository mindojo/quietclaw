import type {
  DigestDecision,
  GatewayMessage,
  RunnerPreference,
  UrgencyDecision,
} from "@quietclaw/gateway-contract";

import { createLinkedAbortController, createAbortError } from "../util/abort";
import { formatSenderName, formatSnippet } from "./normalization";
import { ClaudeCliRunner } from "./runners/claudeRunner";
import { CodexCliRunner } from "./runners/codexRunner";
import { DemoRunner } from "./runners/demoRunner";

export type RunnerId = Exclude<RunnerPreference, "auto">;

export type RunnerAvailability = {
  available: boolean;
  detail: string;
};

export type RunnerResult<T> = {
  runnerId: RunnerId;
  rawDurationMs: number;
  output: T;
};

export type UrgencyPromptInput = {
  watchedGroupName: string;
  targetGroupName: string;
  timestamp: string;
  triggerMessage: {
    senderName: string | null;
    text: string | null;
    caption: string | null;
    hasAttachment: boolean;
    attachmentKind: string | null;
  };
  recentContext: Array<{
    timestamp: string;
    senderName: string | null;
    text: string | null;
    caption: string | null;
  }>;
};

export type DigestPromptInput = {
  watchedGroups: Array<{ id: string; name: string }>;
  targetGroupName: string;
  since: string;
  until: string;
  notes: string[];
  messages: Array<{
    groupName: string;
    timestamp: string;
    senderName: string | null;
    text: string | null;
    caption: string | null;
    hasAttachment: boolean;
    attachmentKind: string | null;
  }>;
};

export interface MonitorInferenceRunner {
  readonly id: RunnerId;
  checkAvailability(): Promise<RunnerAvailability>;
  runUrgency(
    input: UrgencyPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<UrgencyDecision>>;
  runDigest(
    input: DigestPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<DigestDecision>>;
}

export type RunnerStatusSnapshot = {
  id: RunnerPreference;
  label: string;
  available: boolean;
  detail: string;
  selected: boolean;
};

type RunnerManagerOptions = {
  onFallbackWarning?: (summary: string, detail: string) => void;
};

type QueueKind = "urgent" | "digest";

type QueueJob<T> = {
  kind: QueueKind;
  controller: AbortController;
  execute: (signal: AbortSignal) => Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
  started: boolean;
  settled: Promise<void>;
  settle(): void;
};

const RUNNER_LABELS: Record<RunnerPreference, string> = {
  auto: "Auto",
  demo: "Demo",
  codex: "Codex CLI",
  claude: "Claude CLI",
};

export class RunnerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerUnavailableError";
  }
}

export class RunnerQueueFullError extends Error {
  constructor(message = "runner queue full") {
    super(message);
    this.name = "RunnerQueueFullError";
  }
}

export class RunnerShutdownError extends Error {
  constructor(message = "app shutdown") {
    super(message);
    this.name = "RunnerShutdownError";
  }
}

export class RunnerManager {
  private readonly demoRunner = new DemoRunner();
  private readonly codexRunner: CodexCliRunner;
  private readonly claudeRunner: ClaudeCliRunner;
  private readonly availabilityCache = new Map<
    RunnerId,
    { checkedAt: number; result: RunnerAvailability }
  >();
  private readonly queue: QueueJob<unknown>[] = [];
  private readonly activeJobs = new Set<QueueJob<unknown>>();
  private readonly shutdownController = new AbortController();
  private shuttingDown = false;

  constructor(options: RunnerManagerOptions = {}) {
    this.codexRunner = new CodexCliRunner({
      onFallbackWarning: (detail) =>
        options.onFallbackWarning?.(
          "Codex CLI fell back to plain JSON output mode.",
          detail,
        ),
    });
    this.claudeRunner = new ClaudeCliRunner({
      onFallbackWarning: (detail) =>
        options.onFallbackWarning?.(
          "Claude CLI fell back to plain JSON output mode.",
          detail,
        ),
    });
  }

  async getRunnerStatus(selected: RunnerPreference): Promise<RunnerStatusSnapshot[]> {
    const [codex, claude] = await Promise.all([
      this.checkAvailability("codex"),
      this.checkAvailability("claude"),
    ]);

    return [
      {
        id: "auto",
        label: RUNNER_LABELS.auto,
        available: true,
        detail: process.platform === "win32"
          ? "Prefers Claude CLI, then Codex CLI, then Demo."
          : "Prefers Codex CLI, then Claude CLI, then Demo.",
        selected: selected === "auto",
      },
      {
        id: "demo",
        label: RUNNER_LABELS.demo,
        available: true,
        detail: "Built-in deterministic runner for local testing.",
        selected: selected === "demo",
      },
      {
        id: "codex",
        label: RUNNER_LABELS.codex,
        available: codex.available,
        detail: codex.detail,
        selected: selected === "codex",
      },
      {
        id: "claude",
        label: RUNNER_LABELS.claude,
        available: claude.available,
        detail: claude.detail,
        selected: selected === "claude",
      },
    ];
  }

  async runUrgency(
    preference: RunnerPreference,
    input: UrgencyPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<UrgencyDecision>> {
    const runner = await this.selectRunner(preference);
    const rawResult = runner.id === "demo"
      ? await runner.runUrgency(input, signal)
      : await this.enqueue("urgent", signal, (jobSignal) => runner.runUrgency(input, jobSignal));

    return {
      ...rawResult,
      output: postProcessUrgencyDecision(rawResult.output, input),
    };
  }

  async runDigest(
    preference: RunnerPreference,
    input: DigestPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<DigestDecision>> {
    const runner = await this.selectRunner(preference);
    const rawResult = runner.id === "demo"
      ? await runner.runDigest(input, signal)
      : await this.enqueue("digest", signal, (jobSignal) => runner.runDigest(input, jobSignal));

    return {
      ...rawResult,
      output: postProcessDigestDecision(rawResult.output),
    };
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();

      if (!job) {
        continue;
      }

      job.reject(new RunnerShutdownError());
      job.settle();
    }

    this.shutdownController.abort();

    const activeSettles = [...this.activeJobs].map((job) => job.settled);

    if (activeSettles.length === 0) {
      return;
    }

    await Promise.race([
      Promise.allSettled(activeSettles),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }

  private async selectRunner(preference: RunnerPreference): Promise<MonitorInferenceRunner> {
    const order = getRunnerOrder(preference);

    for (const runnerId of order) {
      const runner = this.getRunner(runnerId);

      if (runner.id === "demo") {
        return runner;
      }

      const availability = await this.checkAvailability(runner.id);

      if (availability.available) {
        return runner;
      }

      if (preference !== "auto") {
        throw new RunnerUnavailableError(availability.detail);
      }
    }

    throw new RunnerUnavailableError("No inference runner is available.");
  }

  private getRunner(id: RunnerId): MonitorInferenceRunner {
    switch (id) {
      case "demo":
        return this.demoRunner;
      case "codex":
        return this.codexRunner;
      case "claude":
        return this.claudeRunner;
    }
  }

  private async checkAvailability(id: RunnerId): Promise<RunnerAvailability> {
    if (id === "demo") {
      return {
        available: true,
        detail: "Built-in deterministic runner available.",
      };
    }

    const cached = this.availabilityCache.get(id);

    if (cached && Date.now() - cached.checkedAt < 30_000) {
      return cached.result;
    }

    const runner = this.getRunner(id);
    const result = await runner.checkAvailability();
    this.availabilityCache.set(id, {
      checkedAt: Date.now(),
      result,
    });

    return result;
  }

  private enqueue<T>(
    kind: QueueKind,
    signal: AbortSignal,
    execute: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.shuttingDown) {
      return Promise.reject(new RunnerShutdownError());
    }

    return new Promise<T>((resolve, reject) => {
      const controller = createLinkedAbortController([signal, this.shutdownController.signal]);
      let settle!: () => void;

      const job: QueueJob<T> = {
        kind,
        controller,
        execute,
        reject,
        resolve,
        started: false,
        settled: new Promise<void>((innerResolve) => {
          settle = innerResolve;
        }),
        settle,
      };

      controller.signal.addEventListener(
        "abort",
        () => {
          if (job.started) {
            return;
          }

          const index = this.queue.indexOf(job as QueueJob<unknown>);

          if (index >= 0) {
            this.queue.splice(index, 1);
          }

          reject(
            this.shuttingDown
              ? new RunnerShutdownError()
              : createAbortError("The runner request was aborted."),
          );
          job.settle();
        },
        { once: true },
      );

      this.queue.push(job as QueueJob<unknown>);
      this.trimQueueDepth();
      this.pumpQueue();
    });
  }

  private pumpQueue(): void {
    while (!this.shuttingDown && this.activeJobs.size < 2 && this.queue.length > 0) {
      const nextJob = this.queue.shift();

      if (!nextJob) {
        return;
      }

      nextJob.started = true;
      this.activeJobs.add(nextJob);

      void nextJob.execute(nextJob.controller.signal)
        .then((result) => {
          nextJob.resolve(result);
        })
        .catch((error) => {
          if (this.shuttingDown && !(error instanceof RunnerShutdownError)) {
            nextJob.reject(new RunnerShutdownError());
            return;
          }

          nextJob.reject(error);
        })
        .finally(() => {
          this.activeJobs.delete(nextJob);
          nextJob.settle();
          this.pumpQueue();
        });
    }
  }

  private trimQueueDepth(): void {
    if (this.queue.length <= 6) {
      return;
    }

    const urgentIndex = this.queue.findIndex((job) => job.kind === "urgent");

    if (urgentIndex < 0) {
      return;
    }

    const [droppedJob] = this.queue.splice(urgentIndex, 1);

    if (!droppedJob) {
      return;
    }

    droppedJob.reject(new RunnerQueueFullError());
    droppedJob.settle();
  }
}

function getRunnerOrder(preference: RunnerPreference): RunnerId[] {
  if (preference === "demo" || preference === "codex" || preference === "claude") {
    return [preference];
  }

  return process.platform === "win32"
    ? ["claude", "codex", "demo"]
    : ["codex", "claude", "demo"];
}

function postProcessUrgencyDecision(
  decision: UrgencyDecision,
  input: UrgencyPromptInput,
): UrgencyDecision {
  const urgent = decision.urgent;
  const rationale = decision.rationale.trim().slice(0, 240);
  const confidence = clamp(decision.confidence, 0, 1);
  const suggestedMessage = urgent
    ? truncateText(
      (decision.suggestedMessage?.trim() || buildFallbackUrgentMessage(input, rationale)),
      1000,
    )
    : null;

  return {
    urgent,
    confidence,
    category: decision.category,
    rationale,
    suggestedMessage,
  };
}

function postProcessDigestDecision(decision: DigestDecision): DigestDecision {
  const significanceScore = clamp(
    decision.significanceScore <= 10
      ? decision.significanceScore * 10
      : decision.significanceScore,
    0,
    100,
  );

  return {
    shouldSend: decision.shouldSend,
    significanceScore,
    title: truncateText(decision.title.trim(), 120),
    summary: decision.summary.trim().slice(0, 4000),
    bullets: decision.bullets
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((bullet) => truncateText(bullet, 240)),
    rationale: truncateText(decision.rationale.trim(), 240),
  };
}

function buildFallbackUrgentMessage(
  input: UrgencyPromptInput,
  rationale: string,
): string {
  const snippet = formatSnippet(
    input.triggerMessage.text?.trim() || input.triggerMessage.caption?.trim() || "",
    240,
  );

  return truncateText(
    `⚠️ Urgent item detected from ${input.watchedGroupName}.\n\n${formatSenderName(input.triggerMessage.senderName)}:\n"${snippet || "(no text)"}"\n\n${rationale}`,
    1000,
  );
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
