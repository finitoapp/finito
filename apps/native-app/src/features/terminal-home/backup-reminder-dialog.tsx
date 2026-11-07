import { router } from "expo-router"
import ShieldCheck from "lucide-react-native/icons/shield-check"
import { View, XStack, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { radius } from "../../theme/tokens.ts"
import { useBackupReminder } from "./use-backup-reminder.ts"

/**
 * Web's `BackupReminderDialog`: asks on home to back up the recovery phrase
 * (account/0009). Closing it any way puts it off for a week on this device.
 */
export function BackupReminderDialog() {
  const { t } = useTranslation()
  const { visible, dismiss } = useBackupReminder()

  return (
    <Dialog
      open={visible}
      dismissOnOverlayPress={false}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogContent>
        <YStack testID="backup-reminder" gap="4">
          <XStack items="center" gap={20} px={8} py={8}>
            <View
              w={64}
              h={64}
              items="center"
              justify="center"
              rounded={radius.full}
              bg="primary-10"
            >
              <Icon icon={ShieldCheck} size={32} color="primary" />
            </View>
            <DialogHeader flex={1}>
              <DialogTitle>{t("settings.security.reminder.text")}</DialogTitle>
              <DialogDescription>
                {t("settings.security.reminder.description")}
              </DialogDescription>
            </DialogHeader>
          </XStack>
          <DialogFooter>
            <Button
              label={t("settings.security.reminder.action")}
              onPress={() => {
                dismiss()
                router.push("/settings/security/backup")
              }}
            />
            <Button
              variant="outline"
              label={t("settings.security.reminder.later")}
              onPress={dismiss}
            />
          </DialogFooter>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
