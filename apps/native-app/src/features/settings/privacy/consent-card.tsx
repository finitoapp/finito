import { Text } from "tamagui"
import { SwitchRow } from "../../../components/switch-row.tsx"
import { Card, CardContent } from "../../../components/ui/card.tsx"
import { fontSize } from "../../../theme/tokens.ts"

/**
 * An on/off consent: one switch named after the consent, with what it sends
 * under the name and an optional note below. The switch is its state, so
 * there is no status badge, and its label is the consent's title, so the
 * card draws no header that would repeat it. Web's consent cards say the
 * same with a status badge and an Enable/Disable button.
 */
export function ConsentCard({
  title,
  description,
  note,
  enabled,
  onCheckedChange,
}: {
  /** All already translated. */
  readonly title: string
  readonly description: string
  /** What this runtime makes of the consent, when that needs saying. */
  readonly note?: string | undefined
  readonly enabled: boolean
  readonly onCheckedChange: (enabled: boolean) => void
}) {
  return (
    <Card>
      <CardContent gap={8}>
        <SwitchRow
          label={title}
          description={description}
          checked={enabled}
          onCheckedChange={onCheckedChange}
        />
        {note === undefined ? null : (
          <Text
            px={4}
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
          >
            {note}
          </Text>
        )}
      </CardContent>
    </Card>
  )
}
