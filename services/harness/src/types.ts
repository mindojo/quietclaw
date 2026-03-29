import type { GroupsResponse } from "@quietclaw/gateway-contract";

import type { CapturedMessage } from "../../../apps/desktop-monitor/src/main/telegram/fakeSender.js";
import type { TelegramOnboardingState } from "../../../apps/desktop-monitor/src/main/telegram/onboarding.js";

export type ScenarioLayer = "daemon" | "engine" | "telegram";

export type ScenarioEvent = {
  type: "message";
  mode: "live" | "backfill";
  at: string;
  conversation_id: string;
  conversation_title: string;
  sender_id: string;
  sender_name: string;
  text: string | null;
  caption?: string | null;
};

export type ScenarioAction =
  | { type: "manual_test_summary" }
  | { type: "set_bot_token"; token: string }
  | { type: "push_telegram_update"; update_id: number; chat_id: number; text?: string }
  | { type: "wait"; ms: number };

export type Scenario = {
  id: string;
  description: string;
  layer: ScenarioLayer;
  initial_state?: {
    telegram?: "ready" | "not_configured";
    hidden_groups?: string[];
    monitor?: {
      enabled?: boolean;
      watched_groups?: Array<{
        group_id: string;
        daily_summary?: boolean;
        forward_urgent?: boolean;
      }>;
      runner_preference?: "auto" | "demo" | "codex" | "claude";
      urgent_cooldown_minutes?: number;
    };
    fake_bot?: {
      username?: string;
      get_me_error?: string;
      updates?: Array<{ update_id: number; chat_id: number; text?: string }>;
    };
  };
  events: ScenarioEvent[];
  actions?: ScenarioAction[];
  assertions: Assertion[];
};

export type Assertion =
  | { type: "outbound_count"; channel: "telegram"; equals: number }
  | { type: "outbound_contains"; channel: "telegram"; all_of: string[] }
  | { type: "activity_contains_kind"; kind: string }
  | { type: "visible_group_count"; equals: number }
  | { type: "visible_groups_include"; group_id: string }
  | { type: "visible_groups_exclude"; group_id: string }
  | { type: "group_order"; first: string }
  | { type: "telegram_state"; equals: TelegramOnboardingState }
  | { type: "telegram_chat_id"; equals: number }
  | { type: "telegram_bot_username"; equals: string }
  | { type: "no_outbound" };

export type AssertionResult = { assertion: Assertion; passed: boolean; detail: string };
export type RunResult = {
  scenario_id: string;
  passed: boolean;
  assertions: AssertionResult[];
  duration_ms: number;
};

export type ObservedState = {
  groups: GroupsResponse | null;
  outbound: CapturedMessage[];
  activityKinds: string[];
  telegramStatus?: {
    state: TelegramOnboardingState;
    botUsername: string | null;
    chatId: number | null;
  };
};
