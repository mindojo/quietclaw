import fs from "node:fs";

import { TelegramOnboarding, type TelegramOnboardingState } from "../../../apps/desktop-monitor/src/main/telegram/onboarding.js";
import { FakeTelegramBot } from "../../../apps/desktop-monitor/src/main/telegram/fakeBot.js";

import { runAssertions } from "./assertions.js";
import { DaemonHarness } from "./daemonHarness.js";
import { EngineHarness } from "./engineHarness.js";
import { writeRunReport } from "./reporter.js";
import { scenarioToEnvelopes } from "./scenarioAdapter.js";
import type { ObservedState, RunResult, Scenario, ScenarioAction } from "./types.js";

export async function runScenarioFile(scenarioPath: string): Promise<RunResult> {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8")) as Scenario;
  return runScenario(scenario);
}

export async function runScenario(scenario: Scenario): Promise<RunResult> {
  const startedAt = Date.now();
  const observed = await executeScenario(scenario);
  const assertions = runAssertions(observed, scenario.assertions);
  const result: RunResult = {
    scenario_id: scenario.id,
    passed: assertions.every((assertion) => assertion.passed),
    assertions,
    duration_ms: Date.now() - startedAt,
  };
  writeRunReport(result);
  return result;
}

async function executeScenario(scenario: Scenario): Promise<ObservedState> {
  switch (scenario.layer) {
    case "daemon":
      return runDaemonScenario(scenario);
    case "engine":
      return runEngineScenario(scenario);
    case "telegram":
      return runTelegramScenario(scenario);
    default:
      throw new Error(`Unsupported scenario layer: ${(scenario as Scenario).layer}`);
  }
}

async function runDaemonScenario(scenario: Scenario): Promise<ObservedState> {
  const harness = new DaemonHarness();
  await harness.start();

  try {
    for (const groupId of scenario.initial_state?.hidden_groups ?? []) {
      await harness.hideGroup(groupId);
    }

    await harness.injectEvents(scenarioToEnvelopes(scenario.events));
    await wait(250);

    return {
      groups: await harness.getGroups(),
      outbound: [],
      activityKinds: [],
    };
  } finally {
    await harness.stop();
  }
}

async function runEngineScenario(scenario: Scenario): Promise<ObservedState> {
  const harness = new EngineHarness(scenario);

  try {
    await harness.injectEvents(scenarioToEnvelopes(scenario.events));
    await runActions(scenario.actions ?? [], {
      manual_test_summary: async () => {
        await harness.runManualTestSummary();
      },
    });

    return {
      groups: harness.getGroups(),
      outbound: harness.getOutbound(),
      activityKinds: harness.getActivityKinds(),
    };
  } finally {
    await harness.stop();
  }
}

async function runTelegramScenario(scenario: Scenario): Promise<ObservedState> {
  const config = {
    encryptedBotToken: null,
    botUsername: null,
    chatId: null,
    onboardingState: "not_configured" as TelegramOnboardingState,
    lastVerifiedAt: null,
  };
  const fakeBot = new FakeTelegramBot({
    getMeResult: scenario.initial_state?.fake_bot?.get_me_error
      ? new Error(scenario.initial_state.fake_bot.get_me_error)
      : {
          ok: true,
          username: scenario.initial_state?.fake_bot?.username ?? "test_bot",
        },
    updates: (scenario.initial_state?.fake_bot?.updates ?? []).map((update) => ({
      update_id: update.update_id,
      message: {
        chat: { id: update.chat_id },
        ...(update.text ? { text: update.text } : {}),
      },
    })),
  });

  const onboarding = new TelegramOnboarding(
    () => undefined,
    {
      getTelegramConfig: () => config,
      setTelegramConfig: (updater) => {
        Object.assign(config, updater(config));
      },
    },
    () => fakeBot,
  );

  try {
    await runActions(scenario.actions ?? [], {
      set_bot_token: async (action) => {
        await onboarding.setBotToken(action.token);
      },
      push_telegram_update: async (action) => {
        fakeBot.pushUpdate({
          update_id: action.update_id,
          message: {
            chat: { id: action.chat_id },
            ...(action.text ? { text: action.text } : {}),
          },
        });
      },
      wait: async (action) => {
        await wait(action.ms);
      },
    });

    const status = onboarding.getStatus();
    return {
      groups: null,
      outbound: [],
      activityKinds: [],
      telegramStatus: {
        state: status.state,
        botUsername: status.botUsername,
        chatId: status.chatId,
      },
    };
  } finally {
    onboarding.destroy();
  }
}

async function runActions(
  actions: ScenarioAction[],
  handlers: Partial<Record<ScenarioAction["type"], (action: any) => Promise<void>>>,
): Promise<void> {
  for (const action of actions) {
    if (action.type === "manual_test_summary") {
      await handlers.manual_test_summary?.(action);
      continue;
    }
    if (action.type === "set_bot_token") {
      await handlers.set_bot_token?.(action);
      continue;
    }
    if (action.type === "push_telegram_update") {
      await handlers.push_telegram_update?.(action);
      continue;
    }
    if (action.type === "wait") {
      await handlers.wait?.(action);
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
