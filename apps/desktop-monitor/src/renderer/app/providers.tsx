import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useAppStore } from "../state/appStore";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 15_000,
    },
  },
});

function ZustandBootstrap({
  children,
}: PropsWithChildren): JSX.Element {
  useAppStore((state) => state.settingsOpen);
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ZustandBootstrap>{children}</ZustandBootstrap>
    </QueryClientProvider>
  );
}
