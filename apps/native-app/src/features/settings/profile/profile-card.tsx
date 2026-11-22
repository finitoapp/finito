import { shortenNpub } from "@payky/core/integrations/nostr/nostr-client"
import { Text, YStack } from "tamagui"
import { LucideGlyph } from "../../../components/lucide-glyph"
import {
  type PressFillColors,
  pressFillClause,
  useFastTransition,
} from "../../../components/ui/press-fill.tsx"
import { VerticalNavShell } from "../../../components/vertical-nav.tsx"
import { usePathnameSelect } from "../../../core/current-pathname.ts"
import { useMasterPane } from "../../../core/master-pane.ts"
import {
  useActiveNostrProfile,
  useNostrIdentity,
} from "../../../hooks/use-nostr-profile.ts"
import { useOpenDetail } from "../../../hooks/use-open-detail.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { useAppColors } from "../../../theme/app-colors.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { AccountAvatar } from "../account-avatar.tsx"

/** The card's fill at rest and under the finger, while its editor is closed. */
const cardFill = {
  rest: "card",
  pressed: "accent",
} as const satisfies PressFillColors

/**
 * Web `apps/web-app/src/features/settings/profile/profile-card.tsx`: the
 * account's Nostr profile at the top of the settings list, the same one
 * Linky shows for this recovery phrase. Opens the profile editor.
 *
 * Tailwind mirrored: the vertical-nav shell `flex-row items-center gap-4
 * px-4 py-3 hover:bg-accent/50`; avatar `size-14` (`AccountAvatar`, web's
 * `ProfileAvatar`, the app icon until a picture is published); name
 * `truncate text-base font-semibold`, muted while unset; npub `truncate
 * text-xs text-muted-foreground`; `ChevronRight` `size-4` muted.
 *
 * Native differences: the npub uses Manrope, as native has no mono font
 * token; in a wide window's master pane the card is tinted while the
 * editor is open beside it (navigation/0002); the hover fill is also the
 * fill under the finger (`ui/press-fill.tsx`).
 */
export function ProfileCard() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const profile = useActiveNostrProfile()
  const openDetail = useOpenDetail()
  const colors = useAppColors()
  const masterPane = useMasterPane()
  const editorOpen = usePathnameSelect(
    (pathname) => masterPane !== null && pathname === "/settings/profile"
  )
  const name = profile.data?.name ?? null
  const pending = profile.data === null && profile.loading
  const picture = profile.data?.picture ?? null
  const transition = useFastTransition()

  return (
    <VerticalNavShell
      flexDirection="row"
      items="center"
      gap={16}
      px={16}
      py={12}
      bg={editorOpen ? "accent" : pressFillClause(cardFill)}
      transition={transition}
      cursor="web:pointer"
      onPress={() => openDetail("/settings/profile")}
      role="link"
      aria-label={name ?? t("settings.profile.setName")}
      testID="profile-card"
    >
      <AccountAvatar picture={picture} size={56} />
      <YStack flex={1} minW={0}>
        <Text
          fontSize={fontSize.base}
          lineHeight={fontSize.base}
          fontWeight={fontWeight.semibold}
          color={name === null ? "muted-foreground" : "color"}
          numberOfLines={1}
        >
          {pending ? " " : (name ?? t("settings.profile.setName"))}
        </Text>
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
          numberOfLines={1}
        >
          {shortenNpub(identity.npub)}
        </Text>
      </YStack>
      <LucideGlyph
        name="chevron-right"
        size={20}
        color={colors["muted-foreground"]}
        allowFontScaling={false}
      />
    </VerticalNavShell>
  )
}
