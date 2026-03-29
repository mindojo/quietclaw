import { describe, expect, test } from "vitest";

import {
  cheapUrgentPrefilter,
  extractMeaningfulText,
  formatDigestMessageLine,
  formatSenderName,
  formatSnippet,
  formatUrgencyContextLine,
  normalizeLooseText,
} from "../../apps/desktop-monitor/src/main/monitors/normalization";

describe("normalization", () => {
  test("extractMeaningfulText prefers text, falls back to caption, and returns empty string otherwise", () => {
    expect(
      extractMeaningfulText({
        text: "  Meeting moved to 3pm  ",
        caption: "caption fallback",
      }),
    ).toBe("Meeting moved to 3pm");

    expect(
      extractMeaningfulText({
        text: "   ",
        caption: "  Attachment caption  ",
      }),
    ).toBe("Attachment caption");

    expect(
      extractMeaningfulText({
        text: null,
        caption: null,
      }),
    ).toBe("");
  });

  test("normalizeLooseText lowercases, trims, collapses whitespace, and reduces excess punctuation", () => {
    expect(normalizeLooseText("  HeLLo   THERE!!!!! \n okay???  ")).toBe(
      "hello there!! okay??",
    );
  });

  test.each([null, "", "   "])(
    "cheapUrgentPrefilter skips empty input: %j",
    (text) => {
      expect(
        cheapUrgentPrefilter({
          text,
          caption: null,
          hasAttachment: false,
        }),
      ).toEqual({
        skip: true,
        reason: "empty",
        meaningfulText: "",
        normalizedText: "",
      });
    },
  );

  test("cheapUrgentPrefilter skips when normalized text is shorter than 3 characters", () => {
    expect(
      cheapUrgentPrefilter({
        text: "hi",
        caption: null,
        hasAttachment: false,
      }),
    ).toMatchObject({
      skip: true,
      reason: "short",
      meaningfulText: "hi",
      normalizedText: "hi",
    });
  });

  test.each(["🔥🔥🔥", "@@@ ###"])(
    "cheapUrgentPrefilter skips symbol-only content: %s",
    (text) => {
      expect(
        cheapUrgentPrefilter({
          text,
          caption: null,
          hasAttachment: false,
        }),
      ).toMatchObject({
        skip: true,
        reason: "symbols_only",
      });
    },
  );

  test.each([
    "ok",
    "okay",
    "thanks",
    "thank you",
    "thx",
    "got it",
    "done",
    "k",
    "kk",
    "👍",
    "🙏",
    "❤️",
    "תודה",
    "סבבה",
    "אוקיי",
    "מעולה",
    "קיבלתי",
  ])("cheapUrgentPrefilter skips noise phrases: %s", (text) => {
    expect(
      cheapUrgentPrefilter({
        text,
        caption: null,
        hasAttachment: false,
      }).skip,
    ).toBe(true);
  });

  test("cheapUrgentPrefilter passes actual message content", () => {
    expect(
      cheapUrgentPrefilter({
        text: "Meeting moved to 3pm",
        caption: null,
        hasAttachment: false,
      }),
    ).toMatchObject({
      skip: false,
      reason: "passed",
      meaningfulText: "Meeting moved to 3pm",
      normalizedText: "meeting moved to 3pm",
    });
  });

  test("cheapUrgentPrefilter passes urgent keyword content", () => {
    expect(
      cheapUrgentPrefilter({
        text: "urgent pickup now",
        caption: null,
        hasAttachment: false,
      }),
    ).toMatchObject({
      skip: false,
      reason: "passed",
      normalizedText: "urgent pickup now",
    });
  });

  test("formatSnippet replaces newlines with separators", () => {
    expect(formatSnippet("Line 1\nLine 2\r\nLine 3", 80)).toBe(
      "Line 1 / Line 2 / Line 3",
    );
  });

  test("formatSnippet truncates to the requested limit", () => {
    expect(formatSnippet("1234567890", 5)).toBe("1234…");
  });

  test("formatSenderName returns a trimmed name or Unknown sender", () => {
    expect(formatSenderName("  Alex  ")).toBe("Alex");
    expect(formatSenderName("   ")).toBe("Unknown sender");
    expect(formatSenderName(null)).toBe("Unknown sender");
  });

  test("formatUrgencyContextLine formats timestamp, sender, and snippet", () => {
    expect(
      formatUrgencyContextLine({
        timestamp: "2026-03-25 10:00",
        senderName: "  Alex  ",
        text: "Line 1\nLine 2",
        caption: null,
      }),
    ).toBe("[2026-03-25 10:00] Alex: Line 1 / Line 2");
  });

  test("formatDigestMessageLine formats digest output with group name", () => {
    expect(
      formatDigestMessageLine({
        groupName: "Parents Committee",
        timestamp: "2026-03-25 10:00",
        senderName: null,
        text: null,
        caption: "Photo caption",
      }),
    ).toBe("[2026-03-25 10:00] (Parents Committee) Unknown sender: Photo caption");
  });
});
