import os from "node:os";

import {
  DigestDecisionSchema,
  UrgencyDecisionSchema,
  jsonSchemaBundle,
  type DigestDecision,
  type UrgencyDecision,
} from "@quietclaw/gateway-contract";
import type { ZodType } from "zod";

import { buildDigestPrompt, buildUrgencyPrompt } from "../prompts";
import type {
  DigestPromptInput,
  MonitorInferenceRunner,
  RunnerAvailability,
  RunnerResult,
  UrgencyPromptInput,
} from "../runnerManager";
import {
  extractJsonPayload,
  execFileText,
  isUnsupportedFlagError,
  spawnText,
  unwrapStructuredPayload,
} from "./cliUtils";

type ClaudeCliRunnerOptions = {
  onFallbackWarning?: (detail: string) => void;
};

export class ClaudeCliRunner implements MonitorInferenceRunner {
  readonly id = "claude" as const;
  private structuredOutputSupported: boolean | null = null;
  private noSessionPersistenceSupported: boolean | null = null;
  private fallbackWarningLogged = false;

  constructor(private readonly options: ClaudeCliRunnerOptions = {}) {}

  async checkAvailability(): Promise<RunnerAvailability> {
    try {
      await execFileText("claude", ["--version"], 5_000);
      return {
        available: true,
        detail: "Binary available; authentication checked on first use.",
      };
    } catch (error) {
      return {
        available: false,
        detail: error instanceof Error ? error.message : "Claude CLI was not found.",
      };
    }
  }

  async runUrgency(
    input: UrgencyPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<UrgencyDecision>> {
    return this.runStructured({
      prompt: buildUrgencyPrompt(input),
      resultSchema: UrgencyDecisionSchema,
      schemaJson: jsonSchemaBundle.urgencyDecision,
      timeoutMs: 60_000,
    }, signal);
  }

  async runDigest(
    input: DigestPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<DigestDecision>> {
    return this.runStructured({
      prompt: buildDigestPrompt(input),
      resultSchema: DigestDecisionSchema,
      schemaJson: jsonSchemaBundle.digestDecision,
      timeoutMs: 120_000,
    }, signal);
  }

  private async runStructured<TOutput>(input: {
    prompt: string;
    resultSchema: ZodType<TOutput>;
    schemaJson: unknown;
    timeoutMs: number;
  }, signal: AbortSignal): Promise<RunnerResult<TOutput>> {
    const startedAt = Date.now();
    const schemaText = JSON.stringify(input.schemaJson);

    if (this.structuredOutputSupported !== false) {
      try {
        const raw = await this.runClaudeCommand({
          prompt: input.prompt,
          timeoutMs: input.timeoutMs,
          signal,
          args: [
            "-p",
            "--output-format",
            "json",
            "--json-schema",
            schemaText,
          ],
        });

        const payload = unwrapStructuredPayload(extractJsonPayload(raw.stdout));
        this.structuredOutputSupported = true;

        return {
          runnerId: this.id,
          rawDurationMs: Date.now() - startedAt,
          output: input.resultSchema.parse(payload),
        };
      } catch (error) {
        if (!isUnsupportedFlagError(error, ["--json-schema", "--output-format"])) {
          throw error;
        }

        this.structuredOutputSupported = false;
        this.logFallbackWarningOnce(
          "Installed Claude CLI does not support --json-schema/--output-format json.",
        );
      }
    }

    const fallbackPrompt = `${input.prompt}\n\nReturn valid JSON matching the following schema:\n${JSON.stringify(input.schemaJson, null, 2)}`;
    const raw = await this.runClaudeCommand({
      prompt: fallbackPrompt,
      timeoutMs: input.timeoutMs,
      signal,
      args: ["-p"],
    });
    const payload = unwrapStructuredPayload(extractJsonPayload(raw.stdout));

    return {
      runnerId: this.id,
      rawDurationMs: Date.now() - startedAt,
      output: input.resultSchema.parse(payload),
    };
  }

  private async runClaudeCommand(input: {
    prompt: string;
    timeoutMs: number;
    signal: AbortSignal;
    args: string[];
  }): Promise<{ stdout: string; stderr: string }> {
    const args = [...input.args];

    if (this.noSessionPersistenceSupported !== false) {
      args.push("--no-session-persistence");
    }

    args.push(input.prompt);

    try {
      const result = await spawnText({
        command: "claude",
        args,
        cwd: os.tmpdir(),
        signal: input.signal,
        timeoutMs: input.timeoutMs,
      });

      if (this.noSessionPersistenceSupported === null) {
        this.noSessionPersistenceSupported = true;
      }

      return result;
    } catch (error) {
      if (
        this.noSessionPersistenceSupported !== false &&
        isUnsupportedFlagError(error, ["--no-session-persistence"])
      ) {
        this.noSessionPersistenceSupported = false;

        return spawnText({
          command: "claude",
          args: [...input.args, input.prompt],
          cwd: os.tmpdir(),
          signal: input.signal,
          timeoutMs: input.timeoutMs,
        });
      }

      throw error;
    }
  }

  private logFallbackWarningOnce(detail: string): void {
    if (this.fallbackWarningLogged) {
      return;
    }

    this.fallbackWarningLogged = true;
    this.options.onFallbackWarning?.(detail);
  }
}
