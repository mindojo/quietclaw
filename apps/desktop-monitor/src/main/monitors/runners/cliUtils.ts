import { execFile, spawn } from "node:child_process";

import { createAbortError, withTimeout } from "../../util/abort";
import { getResolvedPath } from "../../util/shellPath";

export class ProcessRunError extends Error {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, input: { code: number | null; stdout: string; stderr: string }) {
    super(message);
    this.name = "ProcessRunError";
    this.code = input.code;
    this.stdout = input.stdout;
    this.stderr = input.stderr;
  }
}

export async function execFileText(
  file: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, {
      timeout: timeoutMs,
      env: { ...process.env, PATH: getResolvedPath() },
    }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new ProcessRunError(error.message, {
            code: typeof error.code === "number" ? error.code : null,
            stdout: stdout.toString(),
            stderr: stderr.toString(),
          }),
        );
        return;
      }

      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      });
    });
  });
}

export async function spawnText(input: {
  command: string;
  args: string[];
  cwd?: string;
  stdinText?: string;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ stdout: string; stderr: string }> {
  const combinedSignal = withTimeout(input.signal, input.timeoutMs);

  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: [input.stdinText ? "pipe" : "ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: getResolvedPath() },
    });

    let stdout = "";
    let stderr = "";
    let forceKillTimer: NodeJS.Timeout | null = null;
    let settled = false;

    const finalize = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
        forceKillTimer = null;
      }

      combinedSignal.removeEventListener("abort", handleAbort);
      callback();
    };

    const handleAbort = (): void => {
      if (child.exitCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 5_000);
    };

    combinedSignal.addEventListener("abort", handleAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      finalize(() => {
        reject(
          new ProcessRunError(error.message, {
            code: null,
            stdout,
            stderr,
          }),
        );
      });
    });

    child.once("close", (code) => {
      finalize(() => {
        if (combinedSignal.aborted) {
          reject(createAbortError(getAbortReason(combinedSignal)));
          return;
        }

        if (code !== 0) {
          reject(
            new ProcessRunError(
              `${input.command} exited with code ${String(code)}.`,
              {
                code,
                stdout,
                stderr,
              },
            ),
          );
          return;
        }

        resolve({ stdout, stderr });
      });
    });

    if (input.stdinText && child.stdin) {
      child.stdin.end(input.stdinText, "utf8");
    }
  });
}

export function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("CLI returned empty output.");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    }
  }

  throw new Error("CLI output did not contain valid JSON.");
}

export function unwrapStructuredPayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const directCandidates = [
    record.result,
    record.output,
    record.data,
    record.response,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate !== "undefined") {
      return unwrapStringJson(candidate);
    }
  }

  if (Array.isArray(record.content)) {
    const textValue = record.content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (typeof entry === "object" && entry !== null && "text" in entry) {
          return typeof entry.text === "string" ? entry.text : "";
        }

        return "";
      })
      .join("\n")
      .trim();

    if (textValue) {
      return unwrapStringJson(textValue);
    }
  }

  return payload;
}

export function isUnsupportedFlagError(
  error: unknown,
  flags: ReadonlyArray<string>,
): boolean {
  if (!(error instanceof ProcessRunError)) {
    return false;
  }

  const haystack = `${error.stdout}\n${error.stderr}\n${error.message}`.toLowerCase();

  return flags.some((flag) => haystack.includes(flag.toLowerCase())) &&
    /(unknown|unexpected|unrecognized|unsupported|invalid).*(flag|option)|not supported/iu.test(
      haystack,
    );
}

function unwrapStringJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return extractJsonPayload(value);
}

function getAbortReason(signal: AbortSignal): string {
  const reason = signal.reason;

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  if (typeof reason === "string" && reason) {
    return reason;
  }

  return "The operation was aborted.";
}
