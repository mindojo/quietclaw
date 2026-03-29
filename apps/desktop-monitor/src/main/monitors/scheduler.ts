import type { AppConfig } from "../config/schema";
import { readAppConfig, updateAppConfig } from "../config/store";
import {
  computeNextDigestRunAt,
  isSameLocalDay,
  nowInTimeZone,
  nowIso,
  setLocalTime,
} from "../util/time";

type SchedulerRunOutcome = {
  status: "success" | "blocked" | "error";
  detail: string;
};

type DigestSchedulerOptions = {
  onDigestDue: () => Promise<SchedulerRunOutcome>;
  onDigestStarted: () => void;
  onError?: (error: unknown) => void;
};

export class DigestScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(private readonly options: DigestSchedulerOptions) {}

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      void this.tick();
    }, 30_000);

    void this.tick();
  }

  stop(): void {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }

    this.ticking = true;

    try {
      const config = readAppConfig();
      updateAppConfig((current) => ({
        ...current,
        scheduler: {
          ...current.scheduler,
          lastTickAt: nowIso(),
          nextRunAt: getNextRunAt(current),
        },
      }));

      if (!shouldAttemptDigest(config)) {
        return;
      }

      const nowLocal = nowInTimeZone(config.monitor.digestTimezone);
      const scheduledToday = setLocalTime(nowLocal, config.monitor.digestTimeLocal);

      if (nowLocal < scheduledToday) {
        return;
      }

      if (
        config.scheduler.lastStatus === "success" &&
        isSameLocalDay(
          config.scheduler.lastFinishedAt,
          nowLocal,
          config.monitor.digestTimezone,
        )
      ) {
        return;
      }

      if (!markRunningAtomically()) {
        return;
      }

      this.options.onDigestStarted();

      const outcome = await this.options.onDigestDue();
      const finishedAt = nowIso();

      updateAppConfig((current) => ({
        ...current,
        scheduler: {
          ...current.scheduler,
          lastFinishedAt: finishedAt,
          lastStatus: outcome.status,
          lastDetail: outcome.detail,
          nextRunAt: getNextRunAt(current),
        },
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Digest scheduler failed.";

      updateAppConfig((current) => ({
        ...current,
        scheduler: {
          ...current.scheduler,
          lastFinishedAt: nowIso(),
          lastStatus: "error",
          lastDetail: detail,
          nextRunAt: getNextRunAt(current),
        },
      }));

      this.options.onError?.(error);
    } finally {
      this.ticking = false;
    }
  }
}

function shouldAttemptDigest(config: AppConfig): boolean {
  return config.monitor.enabled &&
    config.telegram.onboardingState === "ready" &&
    config.telegram.chatId !== null &&
    config.monitor.watchedGroups.some((group) => group.dailySummary);
}

function getNextRunAt(config: AppConfig): string | null {
  if (!shouldAttemptDigest(config)) {
    return null;
  }

  return computeNextDigestRunAt(
    nowInTimeZone(config.monitor.digestTimezone),
    config.monitor.digestTimeLocal,
  );
}

function markRunningAtomically(): boolean {
  let started = false;
  const startedAt = nowIso();

  updateAppConfig((config) => {
    if (config.scheduler.lastStatus === "running") {
      return config;
    }

    started = true;

    return {
      ...config,
      scheduler: {
        ...config.scheduler,
        lastStartedAt: startedAt,
        lastStatus: "running",
        lastDetail: null,
      },
    };
  });

  return started;
}
