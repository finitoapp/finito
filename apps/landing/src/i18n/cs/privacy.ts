import { csSettings } from "@payky/app-shared/i18n/cs/settings"

/**
 * The privacy policy as the app shows it under Settings › About › Data and
 * privacy, taken from the app's own copy so the page and the app can never
 * say two different things (landing/0014).
 */
export const csPrivacy = {
  "settings.about.privacy.heading":
    csSettings["settings.about.privacy.heading"],
  "settings.about.privacy.summary":
    csSettings["settings.about.privacy.summary"],
  "settings.about.privacy.body": csSettings["settings.about.privacy.body"],
} as const
