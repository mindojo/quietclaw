import type { Assertion, AssertionResult, ObservedState } from "./types.js";

export function runAssertions(
  observed: ObservedState,
  assertions: Assertion[],
): AssertionResult[] {
  return assertions.map((assertion) => evaluateAssertion(observed, assertion));
}

function evaluateAssertion(observed: ObservedState, assertion: Assertion): AssertionResult {
  switch (assertion.type) {
    case "outbound_count": {
      const actual = observed.outbound.length;
      return passFail(assertion, actual === assertion.equals, `outbound count ${actual}`);
    }
    case "outbound_contains": {
      const haystack = observed.outbound.map((message) => message.renderedText).join("\n");
      const missing = assertion.all_of.filter((needle) => !haystack.includes(needle));
      return passFail(
        assertion,
        missing.length === 0,
        missing.length === 0 ? "all outbound substrings matched" : `missing: ${missing.join(", ")}`,
      );
    }
    case "activity_contains_kind": {
      return passFail(
        assertion,
        observed.activityKinds.includes(assertion.kind),
        `activity kinds: ${observed.activityKinds.join(", ") || "(none)"}`,
      );
    }
    case "visible_group_count": {
      const actual = observed.groups?.groups.length ?? 0;
      return passFail(assertion, actual === assertion.equals, `visible groups ${actual}`);
    }
    case "visible_groups_include": {
      const found = observed.groups?.groups.some((group) => group.id === assertion.group_id) ?? false;
      return passFail(assertion, found, `group ids: ${listGroupIds(observed)}`);
    }
    case "visible_groups_exclude": {
      const found = observed.groups?.groups.some((group) => group.id === assertion.group_id) ?? false;
      return passFail(assertion, !found, `group ids: ${listGroupIds(observed)}`);
    }
    case "group_order": {
      const first = observed.groups?.groups[0]?.id ?? null;
      return passFail(assertion, first === assertion.first, `first visible group: ${first ?? "(none)"}`);
    }
    case "telegram_state": {
      const state = observed.telegramStatus?.state ?? null;
      return passFail(assertion, state === assertion.equals, `telegram state ${state ?? "(none)"}`);
    }
    case "telegram_chat_id": {
      const chatId = observed.telegramStatus?.chatId ?? null;
      return passFail(assertion, chatId === assertion.equals, `telegram chat id ${chatId ?? "(none)"}`);
    }
    case "telegram_bot_username": {
      const botUsername = observed.telegramStatus?.botUsername ?? null;
      return passFail(
        assertion,
        botUsername === assertion.equals,
        `telegram bot username ${botUsername ?? "(none)"}`,
      );
    }
    case "no_outbound":
      return passFail(assertion, observed.outbound.length === 0, `outbound count ${observed.outbound.length}`);
    default:
      return passFail(assertion, false, "unknown assertion");
  }
}

function passFail(assertion: Assertion, passed: boolean, detail: string): AssertionResult {
  return { assertion, passed, detail };
}

function listGroupIds(observed: ObservedState): string {
  return observed.groups?.groups.map((group) => group.id).join(", ") || "(none)";
}
