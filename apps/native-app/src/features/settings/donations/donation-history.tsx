import { formatDateTime } from "@payky/app-shared/format-date"
import { fetchDonationHistory } from "@payky/core/integrations/donations/donations-client"
import { useInfiniteQuery } from "@tanstack/react-query"
import HeartHandshake from "lucide-react-native/icons/heart-handshake"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import Zap from "lucide-react-native/icons/zap"
import { Text, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { apiUrl } from "../../../core/native-env.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"

/** The donations received so far, newest first, a page at a time. */
export function DonationHistory() {
  const appRun = useAppRun()
  const locale = useLocale()
  const { t } = useTranslation()
  const {
    data,
    isPending,
    isError,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["donations", "history"],
    queryFn: async ({ pageParam }) => {
      await using run = appRun()
      return await run.orThrow(
        fetchDonationHistory({
          endpoint: apiUrl("/api/donations"),
          cursor: pageParam,
        })
      )
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const items = data?.pages.flatMap((page) => page.items) ?? []

  if (isPending) {
    return (
      <ListSkeleton rows={3} title={t("settings.donations.history.title")} />
    )
  }

  if (isError && items.length === 0) {
    return (
      <VerticalNav
        title={t("settings.donations.history.title")}
        items={[]}
        empty={
          <Alert variant="destructive" icon={TriangleAlert}>
            <AlertDescription>
              {t("settings.donations.history.error")}
            </AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                label={t("settings.donations.history.retry")}
                iconStart={RotateCw}
                onPress={() => void refetch()}
              />
            </AlertAction>
          </Alert>
        }
      />
    )
  }

  return (
    <YStack gap={12}>
      <VerticalNav
        title={t("settings.donations.history.title")}
        empty={
          <EmptyState
            icon={HeartHandshake}
            title={t("settings.donations.history.empty.title")}
            description={t("settings.donations.history.empty.description")}
          />
        }
        items={items.map((item) => ({
          id: `${item.occurredAt}-${item.amountSats}`,
          kind: "static" as const,
          disableAction: true,
          icon: (
            <YStack
              w={32}
              h={32}
              shrink={0}
              rounded="full"
              bg="primary-10"
              items="center"
              justify="center"
            >
              <Icon icon={Zap} color="primary" />
            </YStack>
          ),
          label: (
            <YStack gap={4}>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.semibold}
              >
                {t("settings.donations.history.amount", {
                  amount: formatSatsAmount(item.amountSats, locale),
                })}
              </Text>
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
              >
                {formatDateTime(new Date(item.occurredAt), locale)}
              </Text>
            </YStack>
          ),
        }))}
      />
      {isFetchingNextPage ? <ListSkeleton rows={2} /> : null}
      {isFetchNextPageError ? (
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertDescription>
            {t("settings.donations.history.error")}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              label={t("settings.donations.history.retry")}
              iconStart={RotateCw}
              pending={isFetchingNextPage}
              onPress={() => {
                void fetchNextPage()
              }}
            />
          </AlertAction>
        </Alert>
      ) : hasNextPage ? (
        <Button
          size="lg"
          label={t("settings.donations.history.more")}
          variant="outline"
          pending={isFetchingNextPage}
          onPress={() => {
            void fetchNextPage()
          }}
        />
      ) : null}
    </YStack>
  )
}
