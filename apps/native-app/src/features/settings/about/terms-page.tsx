import { Text } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

export function TermsPage() {
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("settings.about.terms.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.about.terms.heading")}</CardTitle>
          <CardDescription>{t("settings.about.terms.summary")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Text
            color="muted-foreground"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
          >
            {t("settings.about.terms.body")}
          </Text>
        </CardContent>
      </Card>
    </Screen>
  )
}
