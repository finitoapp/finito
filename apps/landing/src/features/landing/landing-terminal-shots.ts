import {
  type TerminalShotName,
  terminalShotNames,
} from "@payky/doc-mockups/terminal-shots"
import type { Language } from "@/i18n/resources.ts"

/**
 * The native app's screens on the card terminal, as
 * `apps/native-app/scripts/generate-terminal-screenshots.ts` captures them
 * per language (landing/0015). Globbed rather than imported one by one, so
 * a screenshot not generated yet leaves its step without an image instead of
 * failing the build; `landing-terminal-shots.test.ts` fails on it instead.
 */
const files = import.meta.glob<string>(
  "../../../../native-app/docs/terminal/*/*.webp",
  { eager: true, import: "default" }
)

const shotPath = /\/terminal\/(cs|en|sk)\/([a-z-]+)\.webp$/u

const isTerminalShotName = (name: string): name is TerminalShotName =>
  (terminalShotNames as ReadonlyArray<string>).includes(name)

type ShotUrls = Readonly<Partial<Record<TerminalShotName, string>>>

const shotsOf = (language: Language): ShotUrls =>
  Object.fromEntries(
    Object.entries(files).flatMap(([path, url]) => {
      const [, pathLanguage, name] = shotPath.exec(path) ?? []
      return pathLanguage === language &&
        name !== undefined &&
        isTerminalShotName(name)
        ? [[name, url]]
        : []
    })
  )

/** Each screenshot's URL by language; one not generated yet is missing. */
export const terminalShots: Readonly<Record<Language, ShotUrls>> = {
  en: shotsOf("en"),
  cs: shotsOf("cs"),
  sk: shotsOf("sk"),
}
