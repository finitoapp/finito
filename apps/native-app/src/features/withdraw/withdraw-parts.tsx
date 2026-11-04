import { withdrawalStatusKey } from "@payky/app-shared/withdraw-display"
import type { WithdrawalView } from "@payky/core/modules/withdraw/withdraw-queries"
import LoaderCircle from "lucide-react-native/icons/loader-circle"
import type { ReactNode } from "react"
import { Text as RNText } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { CopyLink } from "../../components/copy-link.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import {
  CollapsibleChevron,
  CollapsibleContent,
  Collapsible as CollapsibleRoot,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import type { ThemeColor } from "../../theme/themes.ts"

/** The withdrawal screens' small shared display pieces. */

/** An identifier the owner may need to copy: selectable, with a Copy link. */
export function Mono({ value }: { readonly value: string }) {
  const theme = useTheme()
  const { t } = useTranslation()
  return (
    <XStack gap="3" items="center" justify="space-between">
      <RNText
        selectable
        style={{
          flex: 1,
          fontSize: 12,
          lineHeight: 16,
          color: theme.color.val,
        }}
      >
        {value}
      </RNText>
      <CopyLink
        value={value}
        aria-label={t("withdraw.detail.copy")}
        copied={t("withdraw.detail.copied")}
        failed={t("withdraw.detail.copyError")}
      />
    </XStack>
  )
}

/** `name@` plain and the domain emphasized: only TLS to that domain vouches for the recipient (withdraw/0005). */
export function LightningAddress({ address }: { readonly address: string }) {
  const at = address.lastIndexOf("@")
  return (
    <Text>
      {address.slice(0, at + 1)}
      <Text fontWeight="700">{address.slice(at + 1)}</Text>
    </Text>
  )
}

const statusBadgeStyle = {
  done: { background: "success-10", foreground: "success" },
  failed: { background: "destructive-tint", foreground: "destructive" },
  pending: { background: "warning-10", foreground: "warning" },
} as const satisfies Record<
  WithdrawalView["state"]["status"],
  {
    readonly background: ThemeColor
    readonly foreground: ThemeColor
  }
>

/** The state in words, coloured as well so it reads at a glance. */
export function WithdrawalStatusBadge({
  view,
}: {
  readonly view: WithdrawalView
}) {
  const { t } = useTranslation()
  const style = statusBadgeStyle[view.state.status]
  return (
    <Badge
      variant="secondary"
      bg={style.background}
      labelColor={style.foreground}
      icon={view.state.status === "pending" ? LoaderCircle : undefined}
      label={t(withdrawalStatusKey(view))}
    />
  )
}

/** A closed-by-default section for what most merchants never need to read. */
export function Collapsible({
  label,
  defaultOpen = false,
  children,
}: {
  readonly label: string
  readonly defaultOpen?: boolean
  readonly children: ReactNode
}) {
  return (
    <CollapsibleRoot defaultOpen={defaultOpen}>
      <CollapsibleTrigger w="100%" py="2">
        <CollapsibleLabel label={label} />
      </CollapsibleTrigger>
      <CollapsibleContent pt="3">
        <YStack gap="3">{children}</YStack>
      </CollapsibleContent>
    </CollapsibleRoot>
  )
}

function CollapsibleLabel({ label }: { readonly label: string }) {
  return (
    <XStack w="100%" items="center" justify="space-between">
      <Text fontSize={13} fontWeight="600" color="muted-foreground">
        {label}
      </Text>
      <CollapsibleChevron color="muted-foreground" />
    </XStack>
  )
}
