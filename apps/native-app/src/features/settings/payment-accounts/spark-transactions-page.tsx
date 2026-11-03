import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { activeSparkAccountsQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { accountTransactionsByAccountQuery } from "@payky/core/modules/account-transaction/account-transaction-queries"
import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../../lib/format-money.ts"

const kindKeys: Partial<Record<AccountTransactionKind, TranslationKey>> = {
  spark: "withdraw.transactions.kind.spark",
  onchain: "withdraw.kind.onchain",
}

/** The Spark account's transactions, read only. */
export function SparkTransactionsPage() {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(activeSparkAccountsQuery)
  const [sparkAccount] = data

  return (
    <Screen>
      <FadeHeader title={t("withdraw.transactions.title")} />
      {sparkAccount === undefined ? null : (
        <SparkTransactions accountId={sparkAccount.id} />
      )}
    </Screen>
  )
}

function SparkTransactions({ accountId }: { readonly accountId: AccountId }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data } = useEvoluQuery(accountTransactionsByAccountQuery(accountId))

  return (
    <VerticalNav
      empty={
        <Text p="4" fontSize="sm" lineHeight="sm" color="muted-foreground">
          {t("withdraw.transactions.empty")}
        </Text>
      }
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
            <YStack w="100%" gap="1" items="flex-start">
              <XStack w="100%" justify="space-between" items="center" gap="2">
                <Text
                  fontSize="sm"
                  lineHeight="sm"
                  fontWeight="600"
                  fontVariant={["tabular-nums"]}
                  color={row.amount > 0 ? "success" : undefined}
                >
                  {amount}
                </Text>
                <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                  {occurredAt}
                </Text>
              </XStack>
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {details}
              </Text>
            </YStack>
          ),
        }
      })}
    />
  )
}
