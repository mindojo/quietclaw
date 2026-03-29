import type { GroupsResponse } from "@quietclaw/gateway-contract";
import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import { DEFAULT_TOKEN } from "../../../services/live-daemon/src/constants.js";
import { createLiveDaemonServer } from "../../../services/live-daemon/src/server.js";

type InjectRequest = {
  method?: "GET" | "POST";
  path: string;
  token?: string;
  body?: unknown;
};

type MockJsonResponse = {
  statusCode: number;
  payload: unknown;
  status(code: number): MockJsonResponse;
  json(payload: unknown): MockJsonResponse;
};

export class DaemonHarness {
  private readonly token: string;
  private readonly server = createLiveDaemonServer({
    host: "127.0.0.1",
    port: 38765,
    token: DEFAULT_TOKEN,
  });

  constructor(token = DEFAULT_TOKEN) {
    this.token = token;
  }

  async start(): Promise<void> {
    this.server.state.start();
  }

  async stop(): Promise<void> {
    this.server.state.stop();
  }

  async injectEvents(events: NormalizedEventEnvelope[]): Promise<void> {
    const response = await injectLiveDaemonRequest(this.server, {
      method: "POST",
      path: "/v2/ingest/events",
      token: this.token,
      body: { events },
    });
    if (response.status !== 200) {
      throw new Error(`Harness ingest failed: ${response.status} ${JSON.stringify(response.json)}`);
    }
  }

  async getGroups(): Promise<GroupsResponse> {
    const response = await injectLiveDaemonRequest(this.server, {
      path: "/v1/groups",
      token: this.token,
    });
    if (response.status !== 200) {
      throw new Error(`Harness groups failed: ${response.status} ${JSON.stringify(response.json)}`);
    }
    return response.json as GroupsResponse;
  }

  async getHealth() {
    return this.server.state.getPublicHealth();
  }

  async hideGroup(groupId: string): Promise<void> {
    const response = await injectLiveDaemonRequest(this.server, {
      method: "POST",
      path: `/v1/groups/${groupId}/hide`,
      token: this.token,
    });
    if (response.status !== 200) {
      throw new Error(`Harness hide failed: ${response.status} ${JSON.stringify(response.json)}`);
    }
  }

  async reset(): Promise<void> {
    this.server.state.stop();
    this.server.state.start();
  }
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

function toQueryRecord(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

function getMountedRouter(
  gateway: ReturnType<typeof createLiveDaemonServer>,
  pathname: string,
) {
  const appStack = (gateway.app as { router: { stack: any[] } }).router.stack;
  const mountedRouter = appStack.find(
    (layer) => layer.name === "router" && layer.matchers[0](pathname),
  );

  if (!mountedRouter) {
    throw new Error(`Mounted router not found for ${pathname}.`);
  }

  return mountedRouter;
}

async function injectLiveDaemonRequest(
  gateway: ReturnType<typeof createLiveDaemonServer>,
  request: InjectRequest,
): Promise<{ status: number; json: unknown }> {
  const method = request.method ?? "GET";
  const url = new URL(request.path, "http://daemon.local");
  const headers = Object.fromEntries(
    Object.entries({
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
