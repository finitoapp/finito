import type { Language } from "@payky/app-shared/i18n/resources"
import Check from "lucide-react-native/icons/check"
import Languages from "lucide-react-native/icons/languages"
import { useState } from "react"
import { languageOptions } from "../../components/language-options.ts"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import { useSetLanguage, useTranslation } from "../../hooks/use-translation.ts"

/**
 * The welcome screen's language picker, as fazole.fit's (Linky's
 * `apps/fazole-app/src/screens/LanguageDialog.tsx`): a round icon button in
 * the top bar that opens a sheet of the languages, the current one marked.
 */
export function LanguageSelect({ disabled }: { readonly disabled?: boolean }) {
  const { language, t } = useTranslation()
  const setLanguage = useSetLanguage()
  const [open, setOpen] = useState(false)

  const choose = (next: Language) => {
    if (next !== language) setLanguage(next)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        iconStart={Languages}
        aria-label={t("onboarding.language.title")}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("accountTransfer.close")}>
          <DialogHeader>
            <DialogTitle>{t("onboarding.language.title")}</DialogTitle>
          </DialogHeader>
          <VerticalNav
            items={languageOptions.map((option) => ({
              id: option.value,
              kind: "button",
              label: option.label,
              active: option.value === language,
              // The chosen language is marked; the others are plain rows.
              ...(option.value === language
                ? { action: <Icon icon={Check} size={20} color="primary" /> }
                : { disableAction: true }),
              onPress: () => choose(option.value),
            }))}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
