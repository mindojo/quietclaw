import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

type CodexCliRunnerOptions = {
  onFallbackWarning?: (detail: string) => void;
};

export class CodexCliRunner implements MonitorInferenceRunner {
  readonly id = "codex" as const;
  private structuredOutputSupported: boolean | null = null;
  private fallbackWarningLogged = false;

  constructor(private readonly options: CodexCliRunnerOptions = {}) {}

  async checkAvailability(): Promise<RunnerAvailability> {
    try {
      await execFileText("codex", ["--version"], 5_000);
      return {
        available: true,
        detail: "Binary available; authentication checked on first use.",
      };
    } catch (error) {
      return {
        available: false,
        detail: error instanceof Error ? error.message : "Codex CLI was not found.",
      };
    }
  }

  async runUrgency(
    input: UrgencyPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<UrgencyDecision>> {
    return this.runStructured({
      input,
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
      input,
      prompt: buildDigestPrompt(input),
      resultSchema: DigestDecisionSchema,
      schemaJson: jsonSchemaBundle.digestDecision,
      timeoutMs: 120_000,
    }, signal);
  }

  private async runStructured<TOutput>(input: {
    input: UrgencyPromptInput | DigestPromptInput;
    prompt: string;
    resultSchema: ZodType<TOutput>;
    schemaJson: unknown;
    timeoutMs: number;
  }, signal: AbortSignal): Promise<RunnerResult<TOutput>> {
    const startedAt = Date.now();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "quietclaw-codex-"));
    const schemaPath = path.join(tempDir, "schema.json");
    const promptPath = path.join(tempDir, "prompt.txt");
    const resultPath = path.join(tempDir, "result.json");
    const schemaText = `${JSON.stringify(input.schemaJson, null, 2)}\n`;

    await writeFile(schemaPath, schemaText, "utf8");
    await writeFile(promptPath, `${input.prompt}\n`, "utf8");

    try {
      let output: TOutput;

      if (this.structuredOutputSupported !== false) {
        try {
          const args = [
            "exec",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--ephemeral",
            "-c", "mcp_servers={}",
            "--output-schema",
            schemaPath,
            "--output-last-message",
            resultPath,
            "--cd",
            tempDir,
            input.prompt,
          ];

          await spawnText({
            command: "codex",
            args,
            cwd: tempDir,
            signal,
            timeoutMs: input.timeoutMs,
          });

          const rawResult = await readFile(resultPath, "utf8");
          output = input.resultSchema.parse(JSON.parse(rawResult) as unknown);
          this.structuredOutputSupported = true;

          return {
            runnerId: this.id,
            rawDurationMs: Date.now() - startedAt,
            output,
          };
        } catch (error) {
          if (!isUnsupportedFlagError(error, ["--output-schema", "--output-last-message"])) {
            throw error;
          }

          this.structuredOutputSupported = false;
          this.logFallbackWarningOnce(
            "Installed Codex CLI does not support --output-schema/--output-last-message.",
          );
        }
      }

      const fallbackPrompt = `${input.prompt}\n\nReturn valid JSON matching the following schema:\n${schemaText}`;
      const fallbackResult = await spawnText({
        command: "codex",
        args: [
          "exec",
          "--sandbox",
          "read-only",
          "--skip-git-repo-check",
          "--ephemeral",
          "-c", "mcp_servers={}",
          "--cd",
          tempDir,
        ],
        cwd: tempDir,
        signal,
        stdinText: fallbackPrompt,
        timeoutMs: input.timeoutMs,
      });

      output = input.resultSchema.parse(
        unwrapStructuredPayload(extractJsonPayload(fallbackResult.stdout)),
      );

      return {
        runnerId: this.id,
        rawDurationMs: Date.now() - startedAt,
        output,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
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
