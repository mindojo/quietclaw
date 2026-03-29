import { z } from "zod";

export const DemoScenarioSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.enum(["urgent", "digest", "health", "membership", "pairing"]),
  })
  .strict();

export const DemoScenariosResponseSchema = z
  .object({
    scenarios: z.array(DemoScenarioSchema),
  })
  .strict();

export const DemoRunScenarioRequestSchema = z
  .object({
    scenarioId: z.string(),
  })
  .strict();

export const DemoRunScenarioResponseSchema = z
  .object({
    accepted: z.boolean(),
    detail: z.string(),
  })
  .strict();

export const DemoResetResponseSchema = z
  .object({
    ok: z.boolean(),
    detail: z.string(),
  })
  .strict();

export type DemoScenario = z.infer<typeof DemoScenarioSchema>;
export type DemoScenariosResponse = z.infer<typeof DemoScenariosResponseSchema>;
export type DemoRunScenarioRequest = z.infer<typeof DemoRunScenarioRequestSchema>;
export type DemoRunScenarioResponse = z.infer<typeof DemoRunScenarioResponseSchema>;
export type DemoResetResponse = z.infer<typeof DemoResetResponseSchema>;
