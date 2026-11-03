import { formatDateTime } from "@payky/app-shared/format-date"
import { fetchDonationHistory } from "@payky/core/integrations/donations/donations-client"
import { useInfiniteQuery } from "@tanstack/react-query"
import CircleAlert from "lucide-react-native/icons/circle-alert"
import HeartHandshake from "lucide-react-native/icons/heart-handshake"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import Zap from "lucide-react-native/icons/zap"
import { Text, YStack } from "tamagui"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { apiUrl } from "../../../core/native-env.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../../lib/format-money.ts"

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
          <YStack items="center" justify="center" gap="4" py="10">
            <Icon icon={CircleAlert} size={40} color="destructive" />
            <Text
              color="muted-foreground"
              text="center"
              fontSize="sm"
              lineHeight="sm"
              role="alert"
            >
              {t("settings.donations.history.error")}
            </Text>
            <Button
              variant="outline"
              size="sm"
              label={t("settings.donations.history.retry")}
              iconStart={RotateCw}
              onPress={() => void refetch()}
            />
          </YStack>
        }
      />
    )
  }

  return (
    <YStack gap="3">
      <VerticalNav
        title={t("settings.donations.history.title")}
        empty={
          <YStack items="center" justify="center" gap="8" py="10">
            <Icon icon={HeartHandshake} size={40} color="muted-foreground" />
            <Text fontSize="lg" lineHeight="lg">
              {t("settings.donations.history.empty.title")}
            </Text>
            <Text
              color="muted-foreground"
              text="center"
              fontSize="sm"
              lineHeight="sm"
            >
              {t("settings.donations.history.empty.description")}
            </Text>
          </YStack>
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
            <YStack gap="1">
              <Text fontWeight="700">
                {t("settings.donations.history.amount", {
                  amount: formatSatsAmount(item.amountSats, locale),
                })}
              </Text>
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {formatDateTime(new Date(item.occurredAt), locale)}
              </Text>
            </YStack>
          ),
        }))}
      />
      {isFetchingNextPage ? <ListSkeleton rows={2} /> : null}
      {isFetchNextPageError ? (
        <Text color="destructive" role="alert">
          {t("settings.donations.history.error")}
        </Text>
      ) : null}
      {hasNextPage ? (
        <Button
          size={isFetchNextPageError ? "sm" : "lg"}
          label={t(
            isFetchNextPageError
              ? "settings.donations.history.retry"
              : "settings.donations.history.more"
          )}
          variant="outline"
          iconStart={isFetchNextPageError ? RotateCw : undefined}
          pending={isFetchingNextPage}
          onPress={() => {
            void fetchNextPage()
          }}
        />
      ) : null}
    </YStack>
  )
}
