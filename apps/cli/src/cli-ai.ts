import { type ConsoleDep, ok, type Task } from "@evolu/common"
import type { AiModelDep } from "@payky/core/ai/ai-model"
import { askAssistant, createDataTools } from "@payky/core/ai/assistant"
import { createRepoAiTools } from "@payky/core/ai/repo-ai-tools"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import type { Command } from "commander"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"
import { printCliError } from "./cli-errors.ts"
import { createGitRepoFiles } from "./git-repo-files.ts"
import { repositoryRoot } from "./paths.ts"

export const registerAiCommand =
  (program: Command): Task<void, never, AiModelDep & EvoluDep & ConsoleDep> =>
  (run) => {
    program.addCommand(
      zodCommand({
        name: "ai",
        description:
          "Ask the assistant a question about your data, the docs or the code.",
        args: {
          prompt: z.string().trim().min(1).describe("The question to ask"),
        },
        opts: {},
        async action({ prompt }) {
          const result = await run(
            askAssistant({
              // The CLI is Payky's (`payky ai`), on Payky's AI proxy by default.
              appName: "Payky",
              messages: [{ role: "user", content: prompt }],
              tools: {
                ...createDataTools(run),
                ...createRepoAiTools(createGitRepoFiles(repositoryRoot)),
              },
              onText: (text) => process.stdout.write(text),
            })
          )
          process.stdout.write("\n")
          if (!result.ok) {
            const { error } = result.error
            printCliError(
              run.deps.console,
              `AI request failed: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        },
      })
    )
    return ok(undefined)
  }
