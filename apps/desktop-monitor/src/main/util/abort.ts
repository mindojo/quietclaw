export function createAbortError(message = "The operation was aborted."): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function throwIfAborted(signal: AbortSignal, message?: string): void {
  if (signal.aborted) {
    throw createAbortError(message ?? "The operation was aborted.");
  }
}

export function createLinkedAbortController(
  signals: ReadonlyArray<AbortSignal>,
): AbortController {
  const controller = new AbortController();

  const abort = (): void => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
  }

  return controller;
}

export function withTimeout(signal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}
