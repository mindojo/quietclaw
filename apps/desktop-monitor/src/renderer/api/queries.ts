import { useQuery } from "@tanstack/react-query";
import type { GroupsResponse } from "@quietclaw/gateway-contract";

import type {
  DaemonStatus,
  DesktopMonitorConfig,
  TelegramStatus,
} from "../../preload/api";
import { monitorAppClient } from "./ipcClient";

export const queryKeys = {
  daemonStatus: ["daemon", "status"] as const,
  groups: ["daemon", "groups"] as const,
  monitor: ["monitor"] as const,
  telegramStatus: ["telegram", "status"] as const,
};

type QueryOptions<T> = {
  enabled?: boolean;
  initialData?: T | undefined;
};

export function useTelegramStatusQuery(
  options: QueryOptions<TelegramStatus> = {},
) {
  return useQuery({
    queryKey: queryKeys.telegramStatus,
    queryFn: () => monitorAppClient.getTelegramStatus(),
    ...(typeof options.enabled === "boolean" ? { enabled: options.enabled } : {}),
    ...(typeof options.initialData !== "undefined" ? { initialData: options.initialData } : {}),
  });
}

export function useDaemonStatusQuery(
  options: QueryOptions<DaemonStatus> = {},
) {
  return useQuery({
    queryKey: queryKeys.daemonStatus,
    queryFn: () => monitorAppClient.getDaemonStatus(),
    ...(typeof options.enabled === "boolean" ? { enabled: options.enabled } : {}),
    ...(typeof options.initialData !== "undefined" ? { initialData: options.initialData } : {}),
  });
}

export function useGroupsQuery(
  options: QueryOptions<GroupsResponse | null> = {},
) {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => monitorAppClient.getGroups(),
    ...(typeof options.enabled === "boolean" ? { enabled: options.enabled } : {}),
    ...(typeof options.initialData !== "undefined" ? { initialData: options.initialData } : {}),
  });
}

export function useMonitorQuery(
  options: QueryOptions<DesktopMonitorConfig> = {},
) {
  return useQuery({
    queryKey: queryKeys.monitor,
    queryFn: () => monitorAppClient.getMonitor(),
    ...(typeof options.enabled === "boolean" ? { enabled: options.enabled } : {}),
    ...(typeof options.initialData !== "undefined" ? { initialData: options.initialData } : {}),
  });
}
