import { z } from "zod";

export const ErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
