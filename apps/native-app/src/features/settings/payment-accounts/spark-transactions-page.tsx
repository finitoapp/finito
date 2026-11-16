import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { activeSparkAccountsQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { accountTransactionsByAccountQuery } from "@payky/core/modules/account-transaction/account-transaction-queries"
import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import ReceiptText from "lucide-react-native/icons/receipt-text"
import { Text, XStack, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"

const kindKeys: Partial<Record<AccountTransactionKind, TranslationKey>> = {
  spark: "withdraw.transactions.kind.spark",
  onchain: "withdraw.kind.onchain",
}

/**
 * The Spark account's transactions, read only; an empty state when there are
 * none yet or no Spark account to have any.
 */
export function SparkTransactionsPage() {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(activeSparkAccountsQuery)
  const [sparkAccount] = data

  return (
    <Screen>
      <FadeHeader title={t("withdraw.transactions.title")} />
      {sparkAccount === undefined ? (
        <EmptyState
          icon={ReceiptText}
          description={t("withdraw.noAccount.title")}
        />
      ) : (
        <SparkTransactions accountId={sparkAccount.id} />
      )}
    </Screen>
  )
}

function SparkTransactions({ accountId }: { readonly accountId: AccountId }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data } = useEvoluQuery(accountTransactionsByAccountQuery(accountId))

  if (data.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        description={t("withdraw.transactions.empty")}
      />
    )
  }

  return (
    <VerticalNav
      items={data.map((row) => {
        const kindKey = kindKeys[row.kind]
        const amount = `${row.amount > 0 ? "+" : "−"}${t("withdraw.sats", {
          amount: formatSatsAmount(Math.abs(row.amount), locale),
        })}`
        const occurredAt = formatDateTime(new Date(row.occurredAt), locale)
        const details = [kindKey === undefined ? null : t(kindKey), row.note]
          .filter((part) => part !== null)
          .join(" · ")
        return {
          id: row.id,
          kind: "static" as const,
          accessibilityLabel: [amount, occurredAt, details]
            .filter((part) => part !== "")
            .join(", "),
          label: (
            <YStack w="100%" gap={4} items="flex-start">
              <XStack w="100%" justify="space-between" items="center" gap={8}>
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  fontWeight={fontWeight.semibold}
                  fontVariant={["tabular-nums"]}
                  color={row.amount > 0 ? "success" : undefined}
                >
                  {amount}
                </Text>
                <Text
                  fontSize={fontSize.xs}
                  lineHeight={fontSize.xs}
                  color="muted-foreground"
                >
                  {occurredAt}
                </Text>
              </XStack>
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
              >
                {details}
              </Text>
            </YStack>
          ),
        }
      })}
    />
  )
}
