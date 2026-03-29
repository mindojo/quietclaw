import { exec } from "node:child_process";
import os from "node:os";
import path from "node:path";

let resolvedPath: string | null = null;
const isWindows = process.platform === "win32";

/**
 * Resolve the user's full shell PATH.
 *
 * On macOS/Linux, Electron GUI apps inherit a minimal PATH from launchd
 * that doesn't include ~/.local/bin, ~/.nvm/..., /opt/homebrew/bin, etc.
 * We run the user's login+interactive shell to get their real PATH.
 *
 * On Windows, process.env.PATH is already complete — no fix needed.
 */
export async function resolveUserShellPath(): Promise<string> {
  if (resolvedPath) {
    return resolvedPath;
  }

  // Windows PATH is already complete from the registry
  if (isWindows) {
    resolvedPath = process.env.PATH ?? "";
    return resolvedPath;
  }

  const shell = process.env.SHELL ?? "/bin/zsh";

  try {
    const result = await new Promise<string>((resolve, reject) => {
      // -i (interactive) sources .zshrc/.bashrc where NVM/pyenv/etc are configured
      // -l (login) sources .zprofile/.profile for additional PATH entries
      // Together they get the complete user PATH
      exec(
        `${shell} -ilc "echo -n \\$PATH"`,
        { timeout: 10_000, env: { ...process.env, HOME: os.homedir() } },
        (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout.toString().trim());
        },
      );
    });

    if (result.length > 0) {
      resolvedPath = result;
      console.log(`[shellPath] Resolved user PATH (${result.split(":").length} entries)`);
      return result;
    }
  } catch (err) {
    console.warn("[shellPath] Failed to resolve shell PATH:", err instanceof Error ? err.message : err);
  }

  // Fallback: combine current PATH with common tool locations
  const home = os.homedir();
  const fallback = [
    process.env.PATH ?? "",
    "/usr/local/bin",
    path.join(home, ".local", "bin"),
    path.join(home, ".nvm", "versions", "node"),
    "/opt/homebrew/bin",
  ].join(":");

  resolvedPath = fallback;
  console.log("[shellPath] Using fallback PATH");
  return fallback;
}

/**
 * Get exec options with the user's resolved PATH.
 */
export function shellExecOptions(
  overrides: { timeout?: number; cwd?: string } = {},
): { env: Record<string, string | undefined>; timeout?: number; cwd?: string; shell?: string } {
  const opts: {
    env: Record<string, string | undefined>;
    timeout?: number;
    cwd?: string;
    shell?: string;
  } = {
    env: {
      ...process.env,
      PATH: resolvedPath ?? process.env.PATH,
    },
    ...overrides,
  };

  // Only override shell on macOS/Linux
  if (!isWindows) {
    opts.shell = process.env.SHELL ?? "/bin/zsh";
  }

  return opts;
}

/**
 * Get the resolved PATH string (or current process PATH as fallback).
 */
export function getResolvedPath(): string {
  return resolvedPath ?? process.env.PATH ?? "";
}
