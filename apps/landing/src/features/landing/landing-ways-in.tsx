import { DownloadIcon, type LucideIcon, StoreIcon, ZapIcon } from "lucide-react"
import { useSyncExternalStore } from "react"
import { landingAppEntryUrl, landingSite } from "@/core/landing-site.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"

interface NativeOption {
  readonly id: "googlePlay" | "zapstore" | "apk"
  readonly icon: LucideIcon
  readonly label: TranslationKey
  /** `null` where the brand's app is not there. */
  readonly href: string | null
}

const allNativeOptions: ReadonlyArray<NativeOption> = [
  {
    id: "googlePlay",
    icon: StoreIcon,
    label: "landing.closing.get.googlePlay.label",
    href: landingSite.googlePlayUrl,
  },
  {
    id: "zapstore",
    icon: ZapIcon,
    label: "landing.closing.get.zapstore.label",
    href: landingSite.zapstoreUrl,
  },
  {
    id: "apk",
    icon: DownloadIcon,
    label: "landing.closing.get.apk.label",
    href: landingSite.apkUrl,
  },
]

export type OfferedNativeOption = NativeOption & { readonly href: string }

/**
 * Where the native app comes from, in order: the stores the brand's app is
 * listed in, then the newest APK (landing/0016). The first is the one an
 * Android visitor is sent to.
 */
export const nativeOptions: ReadonlyArray<OfferedNativeOption> =
  allNativeOptions.flatMap((option) =>
    option.href === null ? [] : [{ ...option, href: option.href }]
  )

/** A store opens in a tab of its own; the APK downloads from this one. */
export const nativeLinkProps = (option: OfferedNativeOption) =>
  option.id === "apk"
    ? { href: option.href }
    : { href: option.href, target: "_blank", rel: "noopener noreferrer" }

const subscribeToNothing = () => () => {}

/**
 * Whether the visitor is on Android, whose main way in is the native app
 * (landing/0016). `false` on the server and while hydrating, so the
 * prerendered page and the first render agree (landing/0002); an Android
 * visitor's page switches right after.
 */
export const useIsAndroid = (): boolean =>
  useSyncExternalStore(
    subscribeToNothing,
    () => /android/iu.test(navigator.userAgent),
    () => false
  )

export type MainWayIn =
  | { readonly kind: "native"; readonly option: OfferedNativeOption }
  | { readonly kind: "web"; readonly href: string }

/**
 * The page's main action: the recommended store on Android, opening the web
 * app everywhere else (landing/0016).
 */
export function useMainWayIn(language: Language): MainWayIn {
  const isAndroid = useIsAndroid()
  const [recommended] = nativeOptions
  return isAndroid && recommended !== undefined
    ? { kind: "native", option: recommended }
    : { kind: "web", href: landingAppEntryUrl(language) }
}
