import { describe, expect, test } from "vitest";

import { DemoRunner } from "../../apps/desktop-monitor/src/main/monitors/runners/demoRunner";

function createUrgencyInput(text: string) {
  return {
    watchedGroupName: "Parents Committee",
    targetGroupName: "My Alerts",
    timestamp: "2026-03-25T10:00:00.000Z",
    triggerMessage: {
      senderName: "Alex",
      text,
      caption: null,
      hasAttachment: false,
      attachmentKind: null,
    },
    recentContext: [],
  } as const;
}

function createDigestMessage(text: string | null, groupName = "Parents Committee") {
  return {
    groupName,
    timestamp: "2026-03-25T10:00:00.000Z",
    senderName: "Alex",
    text,
    caption: null,
    hasAttachment: false,
    attachmentKind: null,
  } as const;
}

async function runUrgency(text: string) {
  const runner = new DemoRunner();
  return runner.runUrgency(createUrgencyInput(text), new AbortController().signal);
}

async function runDigest(messages: Array<ReturnType<typeof createDigestMessage>>) {
  const runner = new DemoRunner();
  return runner.runDigest(
    {
      watchedGroups: [{ id: "grp_parents_001", name: "Parents Committee" }],
      targetGroupName: "My Alerts",
      since: "2026-03-24T10:00:00.000Z",
      until: "2026-03-25T10:00:00.000Z",
      notes: [],
      messages,
    },
    new AbortController().signal,
  );
}

describe("DemoRunner.runUrgency", () => {
  test.each([
    "urgent pickup now",
    "please reply asap",
    "come immediately",
    "today is cancelled",
    "medical issue",
    "ambulance requested",
    "call the police",
    "דחוף להגיע עכשיו",
    "מייד לכניסה",
    "אמבולנס בדרך",
    "משטרה כבר כאן",
  ])("marks urgent wording as urgent: %s", async (text) => {
    const result = await runUrgency(text);

    expect(result.output.urgent).toBe(true);
    expect(result.output.suggestedMessage).toEqual(expect.any(String));
  });

  test.each([
    "thanks everyone",
    "ok see you",
    "good morning",
  ])("does not mark routine chat as urgent: %s", async (text) => {
    const result = await runUrgency(text);

    expect(result.output).toMatchObject({
      urgent: false,
      confidence: 0.2,
      suggestedMessage: null,
      category: "other",
    });
  });

  test("assigns medical category for medical keywords", async () => {
    const result = await runUrgency("Medical emergency, ambulance requested now");

    expect(result.output).toMatchObject({
      urgent: true,
      category: "medical",
      confidence: 0.92,
    });
  });

  test("assigns security category for security keywords", async () => {
    const result = await runUrgency("Please call the police right away");

    expect(result.output).toMatchObject({
      urgent: true,
      category: "security",
      confidence: 0.92,
    });
  });

  test("assigns schedule_change category for cancellation keywords", async () => {
    const result = await runUrgency("The school pickup is cancelled");

    expect(result.output).toMatchObject({
      urgent: true,
      category: "schedule_change",
      confidence: 0.8,
    });
  });

  test("includes a suggested message only when urgent", async () => {
    const urgent = await runUrgency("urgent pickup now");
    const routine = await runUrgency("good morning");

    expect(urgent.output.suggestedMessage).toContain("Urgent item detected");
    expect(routine.output.suggestedMessage).toBeNull();
  });
});

describe("DemoRunner.runDigest", () => {
  test("returns shouldSend=false when fewer than two meaningful messages remain", async () => {
    const result = await runDigest([
      createDigestMessage("Thanks"),
      createDigestMessage("   "),
    ]);

    expect(result.output).toMatchObject({
      shouldSend: false,
      bullets: [],
    });
    expect(result.output.summary).toContain("Fewer than two meaningful messages");
  });

  test("returns shouldSend=true for four keyword-rich digest messages", async () => {
    const result = await runDigest([
      createDigestMessage("School trip payment is due tonight."),
      createDigestMessage("Meeting moved to the library at 18:00."),
      createDigestMessage("Medical form must be submitted tomorrow."),
      createDigestMessage("The schedule was cancelled and replaced."),
    ]);

    expect(result.output.shouldSend).toBe(true);
    expect(result.output.significanceScore).toBeGreaterThanOrEqual(55);
    expect(result.output.summary).toContain("payments");
  });

  test("increases significance score when schedule, medical, and payment keywords are present", async () => {
    const lowSignal = await runDigest([
      createDigestMessage("People are chatting in the group."),
      createDigestMessage("See you later."),
      createDigestMessage("Please bring snacks."),
    ]);
    const highSignal = await runDigest([
      createDigestMessage("Schedule changed for tomorrow."),
      createDigestMessage("Medical form due tonight."),
      createDigestMessage("Payment reminder for the trip."),
    ]);

    expect(highSignal.output.significanceScore).toBeGreaterThan(
      lowSignal.output.significanceScore,
    );
  });
});
