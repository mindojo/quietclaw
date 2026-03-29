import { DateTime } from "luxon";
import type { GroupsResponse, MessageReceivedEventPayload } from "@quietclaw/gateway-contract";
import { MessageReceivedEventPayloadSchema } from "@quietclaw/gateway-contract";
import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import { createDefaultAppConfig, type AppConfig } from "../../../apps/desktop-monitor/src/main/config/schema.js";
import { setAppConfigOverride } from "../../../apps/desktop-monitor/src/main/config/store.js";
import { DaemonClient } from "../../../apps/desktop-monitor/src/main/daemon/client.js";
import { MonitorEngine } from "../../../apps/desktop-monitor/src/main/monitors/engine.js";
import { FakeTelegramSender } from "../../../apps/desktop-monitor/src/main/telegram/fakeSender.js";
import { setNowOverride } from "../../../apps/desktop-monitor/src/main/util/time.js";
import { mapNormalizedEventToGatewayMessage } from "../../../services/live-daemon/src/ingest-v2.js";
import { LiveDaemonState } from "../../../services/live-daemon/src/state.js";

import type { Scenario } from "./types.js";

export class EngineHarness {
  private readonly state = new LiveDaemonState({
    host: "127.0.0.1",
    port: 0,
    token: "quietclaw-demo-token",
  });
  private readonly sender = new FakeTelegramSender();
  private readonly activityKinds: string[] = [];
  private readonly client = new DaemonClient(this.state);
  private readonly engine: MonitorEngine;

  constructor(private readonly scenario: Scenario) {
    setAppConfigOverride(buildScenarioConfig(scenario));
    const scenarioNow = buildScenarioNow(scenario);
    setNowOverride(scenarioNow ? () => scenarioNow : null);
    this.state.start();
    this.engine = new MonitorEngine({
      appendActivity: (kind) => {
        this.activityKinds.push(kind);
      },
      getGroups: () => this.state.getGroups(),
      getMessageSource: () => this.client,
      getOutboundSender: () => this.sender,
    });
  }

  async stop(): Promise<void> {
    await this.engine.shutdown();
    this.state.stop();
    setNowOverride(null);
    setAppConfigOverride(null);
  }

  async injectEvents(events: NormalizedEventEnvelope[]): Promise<void> {
    for (const event of events) {
      this.state.ingestMessage(
        mapNormalizedEventToGatewayMessage(event),
        event.conversation.displayName ?? event.conversation.nativeId,
        {
          id: event.actor.id,
          displayName: event.actor.displayName,
        },
      );
      const payload = toObservedPayload(event);
      await this.engine.handleMessageReceived(payload);
    }
  }

  async runManualTestSummary() {
    return this.engine.runManualTestSummary();
  }

  getGroups(): GroupsResponse {
    return this.state.getGroups();
  }

  getOutbound() {
    return this.sender.getCaptured();
  }

  getActivityKinds(): string[] {
    return [...this.activityKinds];
  }
}

function buildScenarioConfig(scenario: Scenario): AppConfig {
  const defaults = createDefaultAppConfig();
  const watchedGroups = scenario.initial_state?.monitor?.watched_groups ?? [];

  return {
    ...defaults,
    telegram: {
      ...defaults.telegram,
      onboardingState: "ready",
      chatId: 42,
      botUsername: "harness_bot",
    },
    monitor: {
      ...defaults.monitor,
      enabled: scenario.initial_state?.monitor?.enabled ?? true,
      watchedGroups: watchedGroups.map((group) => ({
        groupId: group.group_id,
        dailySummary: group.daily_summary ?? false,
        forwardUrgent: group.forward_urgent ?? false,
      })),
      runnerPreference: scenario.initial_state?.monitor?.runner_preference ?? "demo",
      urgentCooldownMinutes: scenario.initial_state?.monitor?.urgent_cooldown_minutes ?? 30,
    },
  };
}

function buildScenarioNow(scenario: Scenario): DateTime | null {
  const timestamps = scenario.events
    .map((event) => DateTime.fromISO(event.at, { zone: "utc" }))
    .filter((value) => value.isValid);

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.reduce((latest, current) =>
    current.toMillis() > latest.toMillis() ? current : latest,
  ).plus({ minutes: 1 });
}

function toObservedPayload(event: NormalizedEventEnvelope): MessageReceivedEventPayload {
  const message = mapNormalizedEventToGatewayMessage(event);
  return MessageReceivedEventPayloadSchema.parse({
    ...message,
    live: message.deliveryHint === "live",
    groupStatus: "current",
  });
}
