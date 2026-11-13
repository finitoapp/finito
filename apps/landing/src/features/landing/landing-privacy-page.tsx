import { landingPrivacyPaths } from "@/core/landing-site.ts"
import { LandingShell } from "@/features/landing/landing-page.tsx"
import { bodyClassName, Eyebrow } from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { Language } from "@/i18n/resources.ts"

/** A run of the policy's lines: a paragraph, or the lines of a "- " list. */
type PolicyBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: ReadonlyArray<string> }

interface PolicySection {
  readonly title: string | null
  readonly blocks: ReadonlyArray<PolicyBlock>
}

const listItemPrefix = "- "
const numberedTitle = /^\d+\.\s/u

/**
 * The app's policy text (`settings.about.privacy.body`) read into sections:
 * the paragraphs are split by blank lines, a paragraph opening with "1. ..."
 * starts a section titled by that line, and consecutive "- " lines are a
 * list. The text opens with its own title, which the app shows in its card;
 * here the page's heading stands for it, so it is left out.
 */
export function privacyPolicySections(
  body: string
): ReadonlyArray<PolicySection> {
  const paragraphs = body.split(/\n{2,}/u).slice(1)
  return paragraphs.reduce<ReadonlyArray<PolicySection>>(
    (sections, paragraph) => {
      const lines = paragraph.split("\n")
      const [first = "", ...rest] = lines
      const startsSection = numberedTitle.test(first)
      const blocks = linesToBlocks(startsSection ? rest : lines)
      const last = sections.at(-1)
      if (startsSection || last === undefined) {
        return [...sections, { title: startsSection ? first : null, blocks }]
      }
      return [
        ...sections.slice(0, -1),
        { ...last, blocks: [...last.blocks, ...blocks] },
      ]
    },
    []
  )
}

function linesToBlocks(
  lines: ReadonlyArray<string>
): ReadonlyArray<PolicyBlock> {
  return lines.reduce<ReadonlyArray<PolicyBlock>>((blocks, line) => {
    const last = blocks.at(-1)
    if (line.startsWith(listItemPrefix)) {
      const item = line.slice(listItemPrefix.length)
      return last?.kind === "list"
        ? [
            ...blocks.slice(0, -1),
            { kind: "list", items: [...last.items, item] },
          ]
        : [...blocks, { kind: "list", items: [item] }]
    }
    return [...blocks, { kind: "paragraph", text: line }]
  }, [])
}

// An address in the text, without the full stop that may end its sentence.
const urlPattern = /(https:\/\/\S*[^\s.,;:])/u

/** `text` with the addresses it names, such as the contact form's, as links. */
function LinkedText({ text }: { readonly text: string }) {
  return text.split(urlPattern).map((part, index) =>
    index % 2 === 1 ? (
      <a
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed string.
        key={index}
        href={part}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

function PolicyBlocks({
  blocks,
}: {
  readonly blocks: ReadonlyArray<PolicyBlock>
}) {
  return blocks.map((block) =>
    block.kind === "list" ? (
      <ul
        key={block.items.join("\n")}
        className="flex list-disc flex-col gap-2 pl-6 leading-relaxed text-pretty text-muted-foreground"
      >
        {block.items.map((item) => (
          <li key={item}>
            <LinkedText text={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p
        key={block.text}
        className="leading-relaxed text-pretty text-muted-foreground"
      >
        <LinkedText text={block.text} />
      </p>
    )
  )
}

/**
 * The privacy policy at an address of its own (landing/0014), which an app
 * store can link to directly: the whole text prerendered, readable before
 * any script runs, with no sign-up or app screen in the way.
 */
export function LandingPrivacyPage({
  language,
}: {
  readonly language: Language
}) {
  return (
    <LandingShell language={language} paths={landingPrivacyPaths}>
      <PrivacyPolicy />
    </LandingShell>
  )
}

function PrivacyPolicy() {
  const { t } = useLandingTranslation()
  const sections = privacyPolicySections(t("settings.about.privacy.body"))
  return (
    <section className="mx-auto max-w-3xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-24">
      <div className="flex flex-col gap-5">
        <Eyebrow>{t("landing.footer.privacy")}</Eyebrow>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {t("settings.about.privacy.heading")}
        </h1>
        <p className={bodyClassName}>{t("settings.about.privacy.summary")}</p>
      </div>
      <article className="mt-12 flex flex-col gap-10">
        {sections.map((section) => (
          <div key={section.title ?? ""} className="flex flex-col gap-3">
            {section.title === null ? null : (
              <h2 className="text-xl font-bold tracking-tight">
                {section.title}
              </h2>
            )}
            <PolicyBlocks blocks={section.blocks} />
          </div>
        ))}
      </article>
    </section>
  )
}
