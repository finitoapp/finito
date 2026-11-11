import { renameCatalogCategoryErrorKeys } from "@payky/app-shared/catalog-category-choice"
import {
  deleteCatalogCategory,
  renameCatalogCategory,
} from "@payky/core/modules/catalog-category/catalog-category-actions"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
import Trash from "lucide-react-native/icons/trash"
import { useState } from "react"
import { Button } from "../../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx"
import { Field, FieldError, FieldLabel } from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

interface EditedCategory {
  readonly id: CatalogCategoryId
  readonly name: string
}

/**
 * Renames or deletes the category an item is in, from the item's form
 * (catalog/0004): Finito has no categories screen, so this is where a
 * category is kept tidy. A rename to a name another category spells is
 * refused; a delete leaves its items without a category, as on web's
 * category screen.
 */
export function CategoryEditDialog({
  category,
  onClose,
}: {
  /** `null` while closed. */
  readonly category: EditedCategory | null
  readonly onClose: () => void
}) {
  return (
    <Dialog
      open={category !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {category === null ? null : (
        <CategoryEditForm category={category} onClose={onClose} />
      )}
    </Dialog>
  )
}

function CategoryEditForm({
  category,
  onClose,
}: {
  readonly category: EditedCategory
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirmedRun = useConfirmedRun()
  const [name, setName] = useState(category.name)
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState(false)

  const save = async () => {
    const parsed = NonEmptyString255Schema.safeParse(name.trim())
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    if (parsed.data === category.name) {
      onClose()
      return
    }
    setPending(true)
    const saved = await runToast(async (run) => {
      const result = await run(
        renameCatalogCategory({ id: category.id, name: parsed.data })
      )
      if (!result.ok) return renameCatalogCategoryErrorKeys[result.error.type]
    })
    setPending(false)
    if (saved) onClose()
  }

  const remove = async () => {
    // The confirmation is a dialog of its own, so this one closes first.
    onClose()
    await confirmedRun(
      {
        title: t("catalog.categories.delete.confirm.title", {
          name: category.name,
        }),
        description: t("catalog.categories.delete.confirm.description", {
          name: category.name,
        }),
        confirmLabel: t("catalog.categories.delete.confirm.confirm"),
        cancelLabel: t("catalog.categories.delete.confirm.cancel"),
        variant: "destructive",
      },
      deleteCatalogCategory(category.id)
    )
  }

  return (
    <DialogContent closeLabel={t("dialog.close")}>
      <DialogHeader>
        <DialogTitle>{t("catalog.categories.form.title.edit")}</DialogTitle>
      </DialogHeader>
      <Field>
        <FieldLabel>{t("catalog.items.form.category.edit.name")}</FieldLabel>
        <Input
          value={name}
          disabled={pending}
          invalid={invalid}
          autoCorrect={false}
          autoFocus
          aria-label={t("catalog.items.form.category.edit.name")}
          placeholder={t("catalog.categories.form.name.placeholder")}
          onChangeText={(next) => {
            setName(next)
            setInvalid(false)
          }}
          onSubmitEditing={() => void save()}
        />
        <FieldError>
          {invalid ? t("catalog.categories.form.name.invalid") : undefined}
        </FieldError>
      </Field>
      <Button
        label={t("catalog.categories.delete")}
        iconStart={Trash}
        variant="destructive"
        disabled={pending}
        onPress={() => void remove()}
      />
      <DialogFooter>
        <Button
          label={t("catalog.categories.form.save.edit")}
          pending={pending}
          onPress={() => void save()}
        />
        <Button
          label={t("catalog.categories.form.cancel")}
          variant="outline"
          disabled={pending}
          onPress={onClose}
        />
      </DialogFooter>
    </DialogContent>
  )
}
