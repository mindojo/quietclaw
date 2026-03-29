import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { DEFAULT_TOKEN } from "../../services/live-daemon/src/constants.js";
import { createLiveDaemonServer } from "../../services/live-daemon/src/server.js";

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

describe("live daemon ingest v2", () => {
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

  test("accepts normalized events and exposes groups and messages", async () => {
    if (!gateway) {
      throw new Error("Gateway was not initialized.");
    }

    const ingestResponse = await injectLiveDaemonRequest(gateway, {
      method: "POST",
      path: "/v2/ingest/events",
      token: DEFAULT_TOKEN,
      headers: {
        "content-type": "application/json",
      },
      body: {
        events: [
          {
            schemaVersion: "1.0",
            adapter: {
              id: "simulator",
              version: "1.0.0",
              officiality: "experimental",
            },
            delivery: {
              mode: "simulated",
              eventType: "message.created",
              eventId: "evt-1",
              occurredAt: "2026-03-28T12:00:00.000Z",
              observedAt: "2026-03-28T12:00:00.100Z",
              isBackfill: false,
            },
            conversation: {
              id: "group-1",
              nativeId: "group-1",
              kind: "group",
              displayName: "Group One",
              tenantId: null,
              threadId: null,
            },
            actor: {
              id: "user-1",
              nativeId: "user-1",
              displayName: "Alice",
              handle: null,
              isBot: false,
            },
            message: {
              id: "msg-1",
              nativeId: "msg-1",
              text: "hello",
              html: null,
              attachments: [],
              replyToMessageId: null,
              edited: false,
              languageHint: null,
            },
            capabilities: {
              history: "none",
              membership: "partial",
            },
            sourceMeta: {},
          },
        ],
      },
    });

    const groupsResponse = await injectLiveDaemonRequest(gateway, {
      path: "/v1/groups",
      token: DEFAULT_TOKEN,
    });
    const messagesResponse = await injectLiveDaemonRequest(gateway, {
      path: "/v1/groups/group-1/messages?since=2026-03-27T00:00:00.000Z&limit=20",
      token: DEFAULT_TOKEN,
    });

    expect(ingestResponse.status).toBe(200);
    expect((groupsResponse.json as { groups: Array<{ id: string; name: string }> }).groups).toHaveLength(1);
    expect((groupsResponse.json as { groups: Array<{ id: string; name: string }> }).groups[0]).toMatchObject({
      id: "group-1",
      name: "Group One",
    });
    expect((messagesResponse.json as { messages: Array<{ id: string; text: string | null }> }).messages).toHaveLength(1);
    expect((messagesResponse.json as { messages: Array<{ id: string; text: string | null }> }).messages[0]).toMatchObject({
      id: "msg-1",
      text: "hello",
    });
  });
});
