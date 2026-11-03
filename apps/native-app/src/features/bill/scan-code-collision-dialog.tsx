import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { getStaffDisplayName } from "@payky/core/modules/catalog-item/catalog-item-utils"
import { Pressable } from "react-native"
import { Text, YStack } from "tamagui"
import { Card } from "../../components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/**
 * `scanCode` uniqueness can't be enforced across devices, so scanning a code
 * assigned to more than one catalog item is an expected outcome: staff pick
 * which one they meant, as web's `ScanCodeCollisionDialog`: a dialog listing
 * each candidate as a card row with its name and price.
 */
export function ScanCodeCollisionDialog({
  candidates,
  onSelect,
  onClose,
}: {
  readonly candidates: ReadonlyArray<CatalogItemRow>
  readonly onSelect: (item: CatalogItemRow) => void
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <Dialog
      open={candidates.length > 0}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent closeLabel={t("dialog.close")}>
        <DialogHeader>
          <DialogTitle>{t("bill.scan.collision.title")}</DialogTitle>
          <DialogDescription>
            {t("bill.scan.collision.description")}
          </DialogDescription>
        </DialogHeader>
        <YStack gap={8}>
          {candidates.map((candidate) => (
            <Pressable
              key={candidate.id}
              role="button"
              onPress={() => onSelect(candidate)}
            >
              <Card
                flexDirection="row"
                items="center"
                justify="space-between"
                gap={8}
                px={16}
                py={12}
              >
                <Text flex={1} fontWeight={fontWeight.medium}>
                  {getStaffDisplayName(candidate)}
                </Text>
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                >
                  {formatMoney(
                    {
                      value: candidate.unitAmount,
                      currency: candidate.currency,
                    },
                    locale
                  )}
                </Text>
              </Card>
            </Pressable>
          ))}
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
