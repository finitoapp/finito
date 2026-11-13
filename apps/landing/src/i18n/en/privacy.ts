import { enSettings } from "@payky/app-shared/i18n/en/settings"

/**
 * The privacy policy as the app shows it under Settings › About › Data and
 * privacy, taken from the app's own copy so the page and the app can never
 * say two different things (landing/0014).
 */
export const enPrivacy = {
  "settings.about.privacy.heading":
    enSettings["settings.about.privacy.heading"],
  "settings.about.privacy.summary":
    enSettings["settings.about.privacy.summary"],
  "settings.about.privacy.body": enSettings["settings.about.privacy.body"],
} as const
