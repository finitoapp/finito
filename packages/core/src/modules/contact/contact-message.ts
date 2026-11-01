import { z } from "zod"

/**
 * What the landing page's contact form sends (support/0003): where to reach
 * the sender, an email or a phone, and whatever they chose to add about
 * themselves. The contact is the point of the form, so one of the two is
 * required; the message and the rest are optional.
 */
export const ContactMessageSchema = z
  .object({
    email: z.email().max(254).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
    message: z.string().trim().max(4000).optional(),
    businessName: z.string().trim().max(200).optional(),
    place: z.string().trim().max(200).optional(),
    /** The landing page's language, so support answers in it. */
    language: z.enum(["cs", "en", "sk"]),
    /**
     * A honeypot: the form never shows this field, so only a bot fills it.
     * Accepted by the schema so the server can drop the message silently.
     */
    website: z.string().max(500).optional(),
  })
  .refine(
    (contact) => contact.email !== undefined || contact.phone !== undefined,
    { message: "An email or a phone is required.", path: ["email"] }
  )
export type ContactMessage = z.output<typeof ContactMessageSchema>

const languageNames = {
  cs: "Czech",
  en: "English",
  sk: "Slovak",
} satisfies Record<ContactMessage["language"], string>

const line = (label: string, value: string | undefined): string | null =>
  value === undefined || value === "" ? null : `${label}: ${value}`

/**
 * The contact message as one chat message for the support team: who is
 * writing and how to reach them first, the message, when there is one,
 * below.
 */
export const formatContactMessage = (contact: ContactMessage): string =>
  [
    line("Email", contact.email),
    line("Phone", contact.phone),
    line("Business", contact.businessName),
    line("Place", contact.place),
    line("Language", languageNames[contact.language]),
    ...(contact.message === undefined || contact.message === ""
      ? []
      : ["", contact.message]),
  ]
    .filter((part) => part !== null)
    .join("\n")

/**
 * The chat's name in Amethyst: the app whose landing it came from, then the
 * business when given, else the contact.
 */
export const contactMessageSubject = (
  contact: ContactMessage,
  appName: string
): string =>
  `${appName} web contact: ${
    contact.businessName !== undefined && contact.businessName !== ""
      ? contact.businessName
      : (contact.email ?? contact.phone ?? "")
  }`
