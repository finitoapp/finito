import { skSettings } from "@payky/app-shared/i18n/sk/settings"

/**
 * The privacy policy as the app shows it under Settings › About › Data and
 * privacy, taken from the app's own copy so the page and the app can never
 * say two different things (landing/0014).
 */
export const skPrivacy = {
  "settings.about.privacy.heading":
    skSettings["settings.about.privacy.heading"],
  "settings.about.privacy.summary":
    skSettings["settings.about.privacy.summary"],
  "settings.about.privacy.body": skSettings["settings.about.privacy.body"],
} as const
