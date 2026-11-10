import { SelfPayRelaysSchema } from "@payky/core/integrations/nostr/nostr-default-relays"
import { RecoveryMnemonicSchema } from "@payky/core/modules/shared/key-derivation"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { resolveDataDir } from "./paths.ts"

export const cliEnv = createEnv({
  server: {
    PAYKY_DATA_DIR: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) => resolveDataDir(value, process.cwd())),
    // Payky's AI proxy (ai/0001), or any OpenAI-compatible endpoint such as
    // a local Ollama at http://localhost:11434/v1.
    PAYKY_AI_BASE_URL: z.url().default("https://payky.me/api/ai/v1"),
    // The proxy picks its own model; another endpoint needs one named.
    PAYKY_AI_MODEL: z.string().trim().min(1).optional(),
    // Runs the one Cashu test against the public test mint (cashu.md, phase 2).
    CASHU_LIVE: z.stringbool().default(false),
    PAYKY_RECOVERY_MNEMONIC: RecoveryMnemonicSchema.optional(),
    PAYKY_SELF_PAY_RELAYS: SelfPayRelaysSchema,
    PAYKY_QERKO_POS_ID: z.string().default("payky"),
    PAYKY_EET_PRODUCTION_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
