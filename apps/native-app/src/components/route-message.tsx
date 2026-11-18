import { Text, View } from "tamagui"
import { showMenuRoot } from "../core/menu-navigation.ts"
import { fontSize } from "../theme/tokens.ts"
import { FadeHeader } from "./fade-header.tsx"
import { Screen } from "./screen.tsx"

/**
 * Web `apps/web-app/src/components/route-message.tsx`: a page's dead end,
 * an id the route can't parse or a row that isn't there. The back arrow goes
 * home and replaces this screen, because a cold open of a stale link has no
 * screen behind it and back must not land in the dead end again.
 *
 * Tailwind mirrored: `flex items-center justify-center px-8 text-center
 * text-lg text-muted-foreground`.
 */
export function RouteMessage({ children }: { readonly children: string }) {
  return (
    <Screen>
      <FadeHeader customStartAddonOnClick={() => showMenuRoot("/")} />
      <View flex={1} items="center" justify="center" px={32}>
        <Text
          fontSize={fontSize.lg}
          lineHeight={fontSize.lg}
          color="muted-foreground"
          text="center"
          role="alert"
        >
          {children}
        </Text>
      </View>
    </Screen>
  )
}
