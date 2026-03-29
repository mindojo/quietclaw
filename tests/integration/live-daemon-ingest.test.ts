import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  EventEnvelopeSchema,
  GroupsResponseSchema,
  MessageReceivedEventPayloadSchema,
} from "../../packages/gateway-contract/src";
import { DEFAULT_TOKEN } from "../../services/live-daemon/src/constants";
import { createLiveDaemonServer } from "../../services/live-daemon/src/server";
import type { GatewayEnvelope } from "../../services/live-daemon/src/types";

type TestGateway = ReturnType<typeof createLiveDaemonServer>;

type InjectRequest = {
  method?: "GET" | "POST";
  path: string;
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type MockJsonResponse = {
  statusCode: number;
  payload: unknown;
  status(code: number): MockJsonResponse;
  json(payload: unknown): MockJsonResponse;
};

type MockSseResponse = {
  chunks: string[];
  end(): void;
  flushHeaders(): void;
  on(event: string, listener: () => void): void;
  setHeader(name: string, value: string): void;
  status(code: number): MockSseResponse;
  write(chunk: string): void;
};

function createEnvelope(input: Partial<GatewayEnvelope["payload"]> & {
  chatId?: string;
  chatTitle?: string;
  eventId?: string;
  messageId?: string;
  timestampMs?: number;
} = {}): GatewayEnvelope {
  const chatId = input.chatId ?? "grp_test";
  const messageId = input.messageId ?? "MSG_0001";
  const timestampMs = input.timestampMs ?? Date.now();

  return {
    receivedAt: new Date().toISOString(),
    source: "whatsapp-web",
    collectorVersion: "integration-test",
    eventType: "incoming-group-message",
    eventId: input.eventId ?? `${chatId}:${messageId}`,
    payload: {
      chatId,
      chatTitle: input.chatTitle ?? "Integration Group",
      senderId: input.senderId ?? "sender_001@lid",
      senderName: input.senderName ?? "Sender One",
      messageId,
      timestampMs,
      text: input.text ?? "hello",
      caption: input.caption,
      rawKind: input.rawKind ?? "chat",
      attachments: input.attachments ?? [],
      metadata: input.metadata ?? {},
      observedAtMs: input.observedAtMs ?? Date.now(),
      hookSource: input.hookSource ?? "event-bus",
    },
  };
}

function createMockJsonResponse(): MockJsonResponse {
  return {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function createMockSseResponse(): MockSseResponse {
  const listeners = new Map<string, () => void>();

  return {
    chunks: [],
    end() {
      listeners.get("close")?.();
    },
    flushHeaders() {},
    on(event: string, listener: () => void) {
      listeners.set(event, listener);
    },
    setHeader() {},
    status() {
      return this;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
    },
  };
}

function toQueryRecord(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

function getMountedRouter(gateway: TestGateway, pathname: string) {
  const appStack = (gateway.app as any).router.stack as any[];
  const mountedRouter = appStack.find(
    (layer) => layer.name === "router" && layer.matchers[0](pathname),
  );

  if (!mountedRouter) {
    throw new Error(`Mounted router not found for ${pathname}.`);
  }

  return mountedRouter;
}

async function injectLiveDaemonRequest(
  gateway: TestGateway,
  request: InjectRequest,
): Promise<{ status: number; json: unknown }> {
  const method = request.method ?? "GET";
  const url = new URL(request.path, "http://daemon.local");
  const headers = Object.fromEntries(
    Object.entries({
      ...request.headers,
      ...(request.token ? { authorization: `Bearer ${request.token}` } : {}),
    }).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const mockRequest = {
    method,
    url: `${url.pathname}${url.search}`,
    originalUrl: `${url.pathname}${url.search}`,
    path: url.pathname,
    query: toQueryRecord(url),
    params: {} as Record<string, string>,
    body: request.body,
    headers,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
  const response = createMockJsonResponse();
  const mountedRouter = getMountedRouter(gateway, url.pathname);
  const mountMatch = mountedRouter.matchers[0](url.pathname);

  if (!mountMatch) {
    return {
      status: 404,
      json: {
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
        },
      },
    };
  }

  const nestedPath = url.pathname.slice(mountMatch.path.length) || "/";
  const routerStack = mountedRouter.handle.stack as any[];
  let authPassed = false;

  routerStack[0].handle(mockRequest, response, () => {
    authPassed = true;
  });

  if (!authPassed) {
    return {
      status: response.statusCode,
      json: response.payload,
    };
  }

  const routeLayer = routerStack.find(
    (layer) =>
      layer.route &&
      layer.route.methods[method.toLowerCase()] &&
      layer.matchers.some((matcher: (path: string) => unknown) => matcher(nestedPath)),
  );

  if (!routeLayer) {
    return {
      status: 404,
      json: {
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
        },
      },
    };
  }

  const routeMatch = routeLayer.matchers[0](nestedPath);
  mockRequest.params = routeMatch?.params ?? {};
  mockRequest.query = toQueryRecord(url);
  await routeLayer.route.stack[0].handle(mockRequest, response);

  return {
    status: response.statusCode,
    json: response.payload,
  };
}

function subscribeToSse(gateway: TestGateway, token: string): MockSseResponse {
  const url = new URL("/v1/events/stream", "http://daemon.local");
  const headers = {
    authorization: `Bearer ${token}`,
  };
  const mockRequest = {
    method: "GET",
    url: url.pathname,
    originalUrl: url.pathname,
    path: url.pathname,
    query: {},
    params: {} as Record<string, string>,
    body: null,
    headers,
    header(name: string) {
      return headers[name.toLowerCase() as keyof typeof headers];
    },
  };
  const response = createMockSseResponse();
  const mountedRouter = getMountedRouter(gateway, url.pathname);
  const mountMatch = mountedRouter.matchers[0](url.pathname);

  if (!mountMatch) {
    throw new Error("Mounted /v1 router did not match SSE path.");
  }

  const nestedPath = url.pathname.slice(mountMatch.path.length) || "/";
  const routerStack = mountedRouter.handle.stack as any[];
  let authPassed = false;

  routerStack[0].handle(mockRequest, response, () => {
    authPassed = true;
  });

  if (!authPassed) {
    throw new Error("SSE auth middleware rejected the request.");
  }

  const routeLayer = routerStack.find(
    (layer) =>
      layer.route &&
      layer.route.methods.get &&
      layer.matchers.some((matcher: (path: string) => unknown) => matcher(nestedPath)),
  );

  if (!routeLayer) {
    throw new Error("SSE route not found.");
  }

  const routeMatch = routeLayer.matchers[0](nestedPath);
  mockRequest.params = routeMatch?.params ?? {};
  routeLayer.route.stack[0].handle(mockRequest, response);

  return response;
}

describe("live daemon ingest", () => {
  let gateway: TestGateway | null = null;

  beforeEach(() => {
    gateway = createLiveDaemonServer({
      host: "127.0.0.1",
      port: 0,
      token: DEFAULT_TOKEN,
    });
    gateway.state.start();
  });

  afterEach(() => {
    gateway?.state.stop();
    gateway = null;
  });

  test("POST /v1/events hydrates groups visible from /v1/groups", async () => {
    if (!gateway) {
      throw new Error("Gateway was not initialized.");
    }

    const first = createEnvelope({
      chatId: "grp_alpha",
      chatTitle: "Alpha Group",
      timestampMs: Date.now() - 5_000,
    });
    const second = createEnvelope({
      chatId: "grp_beta",
      chatTitle: "Beta Group",
      messageId: "MSG_0002",
      timestampMs: Date.now(),
    });

    const ingestResponse = await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v1/events",
      token: DEFAULT_TOKEN,
      headers: {
        "content-type": "application/json",
      },
      body: { events: [first, second] },
    });
    const groupsResponse = await injectLiveDaemonRequest(gateway, {
      path: "/v1/groups",
      token: DEFAULT_TOKEN,
    });
    const groups = GroupsResponseSchema.parse(groupsResponse.json);

    expect(ingestResponse.status).toBe(200);
    expect(groups.groups.map((group) => group.id)).toEqual(["grp_beta", "grp_alpha"]);
    expect(groups.groups[0]).toMatchObject({
      id: "grp_beta",
      name: "Beta Group",
      messageCount24h: 1,
    });
  });

  test("hidden groups stay excluded from /v1/groups even after more ingest", async () => {
    if (!gateway) {
      throw new Error("Gateway was not initialized.");
    }

    await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v1/events",
      token: DEFAULT_TOKEN,
      headers: {
        "content-type": "application/json",
      },
      body: {
        events: [
          createEnvelope({
            chatId: "grp_hidden",
            chatTitle: "Hidden Group",
          }),
        ],
      },
    });
    await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v1/groups/grp_hidden/hide",
      token: DEFAULT_TOKEN,
    });
    await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v1/events",
      token: DEFAULT_TOKEN,
      headers: {
        "content-type": "application/json",
      },
      body: {
        events: [
          createEnvelope({
            chatId: "grp_hidden",
            chatTitle: "Hidden Group",
            messageId: "MSG_0002",
            text: "still hidden",
          }),
        ],
      },
    });

    const groupsResponse = await injectLiveDaemonRequest(gateway, {
      path: "/v1/groups",
      token: DEFAULT_TOKEN,
    });
    const groups = GroupsResponseSchema.parse(groupsResponse.json);

    expect(groups.groups.some((group) => group.id === "grp_hidden")).toBe(false);
  });

  test("SSE emits message.received after ingest", async () => {
    if (!gateway) {
      throw new Error("Gateway was not initialized.");
    }

    const sseResponse = subscribeToSse(gateway, DEFAULT_TOKEN);

    await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v1/events",
      token: DEFAULT_TOKEN,
      headers: {
        "content-type": "application/json",
      },
      body: {
        events: [
          createEnvelope({
            chatId: "grp_sse",
            chatTitle: "SSE Group",
            text: "ping",
          }),
        ],
      },
    });

    const messageChunk = sseResponse.chunks.find((chunk) => chunk.includes("event: message.received"));
    const payloadJson = messageChunk
      ?.split("\n")
      .find((line) => line.startsWith("data:"))
      ?.slice("data:".length)
      .trim();

    expect(messageChunk).toBeDefined();

    const eventEnvelope = EventEnvelopeSchema.parse(JSON.parse(payloadJson ?? "null"));
    const payload = MessageReceivedEventPayloadSchema.parse(eventEnvelope.payload);

    expect(eventEnvelope.type).toBe("message.received");
    expect(payload.groupId).toBe("grp_sse");
    expect(payload.text).toBe("ping");
  });
});
