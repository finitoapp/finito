import { useState } from "react"
import { Image } from "react-native"
import { YStack } from "tamagui"
import appIcon from "../../../assets/app-icon.png"
import { radius } from "../../theme/tokens.ts"

export interface AccountAvatarProps {
  /** The account's last published Nostr picture, `null` while it has none. */
  readonly picture: string | null
  /** The circle's width and height. */
  readonly size: number
}

/**
 * Web `apps/web-app/src/features/settings/profile/profile-avatar.tsx`: an
 * account's picture in a circle, the app icon when the account has none, on
 * the profile card, in the accounts list and on the profile editor.
 *
 * Tailwind mirrored: `shrink-0 rounded-full bg-muted object-cover`, the size
 * passed in (web's `size-14` by default).
 *
 * Native differences: the fill is `surface-raised`, as the kit's raised
 * surfaces; a picture that fails to load falls back to the app icon, where
 * web's `img` shows its broken state. It sits at the settings feature's root
 * because the profile and the accounts screens both draw it.
 */
export function AccountAvatar({ picture, size }: AccountAvatarProps) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null)
  const shown = picture !== null && picture !== failedPicture ? picture : null

  return (
    <YStack
      w={size}
      h={size}
      shrink={0}
      rounded={radius.full}
      overflow="hidden"
      bg="surface-raised"
    >
      <Image
        source={shown === null ? appIcon : { uri: shown }}
        style={{ width: size, height: size }}
        accessibilityIgnoresInvertColors
        onError={shown === null ? undefined : () => setFailedPicture(shown)}
      />
    </YStack>
  )
}
