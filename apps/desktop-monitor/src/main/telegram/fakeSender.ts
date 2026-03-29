import type { OutboundSender } from "../monitors/engine";

export type CapturedMessage = {
  sentAt: string;
  kind: "urgent" | "digest" | "test";
  renderedText: string;
  metadata: Record<string, string>;
};

export class FakeTelegramSender implements OutboundSender {
  private captured: CapturedMessage[] = [];

  isReady(): boolean {
    return true;
  }

  async sendDigest(title: string, body: string): Promise<{ ok: boolean; detail: string }> {
    this.captured.push({
      sentAt: new Date().toISOString(),
      kind: title.toLowerCase().includes("test") ? "test" : "digest",
      renderedText: `${title}\n\n${body}`,
      metadata: {
        title,
      },
    });
    return { ok: true, detail: "Captured by fake sender." };
  }

  async sendUrgent(
    groupName: string,
    senderName: string,
    snippet: string,
    rationale: string,
  ): Promise<{ ok: boolean; detail: string }> {
    this.captured.push({
      sentAt: new Date().toISOString(),
      kind: "urgent",
      renderedText: `Urgent alert from ${groupName}\n\n${senderName}: ${snippet}\n\n${rationale}`,
      metadata: {
        groupName,
        senderName,
        snippet,
        rationale,
      },
    });
    return { ok: true, detail: "Captured by fake sender." };
  }

  getCaptured(): CapturedMessage[] {
    return [...this.captured];
  }

  clear(): void {
    this.captured = [];
  }

  get count(): number {
    return this.captured.length;
  }
}
