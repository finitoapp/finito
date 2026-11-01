import { shortenNpub } from "@payky/core/integrations/nostr/nostr-client"
import { router } from "expo-router"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import { Image } from "react-native"
import { Text, YStack } from "tamagui"
import appIcon from "../../../../assets/app-icon.png"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNavShell } from "../../../components/vertical-nav.tsx"
import {
  useNostrIdentity,
  useNostrProfile,
} from "../../../hooks/use-nostr-profile.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight, radius } from "../../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/features/settings/profile/profile-card.tsx`: the
 * account's Nostr profile at the top of the settings list, the same one
 * Linky shows for this recovery phrase. Opens the profile editor.
 *
 * Tailwind mirrored: the vertical-nav shell `flex-row items-center gap-4
 * px-4 py-3 hover:bg-accent/50`; avatar `size-14 rounded-full bg-muted`
 * (web's `ProfileAvatar`, the app icon until a picture is published); name
 * `truncate text-base font-semibold`, muted while unset; npub `truncate
 * text-xs text-muted-foreground`; `ChevronRight` `size-4` muted.
 *
 * Native difference: the npub uses Inter, as native has no mono font token.
 */
export function ProfileCard() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const profile = useNostrProfile(identity.pubkey)
  const name = profile.data?.name ?? null
  const pending = profile.data === null && profile.loading
  const picture = profile.data?.picture ?? null

  return (
    <VerticalNavShell
      flexDirection="row"
      items="center"
      gap={16}
      px={16}
      py={12}
      bg="card press:accent"
      onPress={() => router.push("/settings/profile")}
      role="link"
      aria-label={name ?? t("settings.profile.setName")}
      testID="profile-card"
    >
      <YStack
        w={56}
        h={56}
        shrink={0}
        rounded={radius.full}
        overflow="hidden"
        bg="muted"
      >
        <Image
          source={picture === null ? appIcon : { uri: picture }}
          style={{ width: 56, height: 56 }}
          accessibilityIgnoresInvertColors
        />
      </YStack>
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
      <Icon icon={ChevronRight} color="muted-foreground" />
    </VerticalNavShell>
  )
}
