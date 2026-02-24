import {
	getOrThrow,
	type Mnemonic,
	NonEmptyString100,
	PositiveInt,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { z } from "zod";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { defaultRelays, nostrRelaysAtom } from "@/atoms/nostr-relays";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrl,
} from "@/lib/shared/types";

export const switchAccountSchema = z.object({
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

export const switchUserDefaultValues = {
	seed: "",
} satisfies z.input<typeof switchAccountSchema>;

const createComponents = (t: TFunction) => createAutoFormLayout(switchAccountSchema, ({ builder }) => ({
	...builder.magicInput("seed").textarea({
		placeholder: t("settings:form.switch-account-form.placeholder.paste-your-seed"),
		rows: 4,
	}),
}));

export const SwitchAccountForm: React.FC<{
	onSuccess?: () => unknown;
}> = (props) => {
	const { t } = useTranslation();
	const setEvoluCounter = useSetAtom(evoluCounterAtom);
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(switchAccountSchema, {
		defaultValues: switchUserDefaultValues,
		saveAction: async (values) => {
			const mnemonic = values.seed as unknown as Mnemonic;

			const existingAccounts = await deviceEvolu.loadQuery(
				deviceEvolu.createQuery((db) =>
					db
						.selectFrom("account")
						.select(["account.id as id"])
						.where("isDeleted", "is not", sqliteTrue)
						.where("mnemonic", "=", mnemonic)
						.limit(1),
				),
			);

			await new Promise<void>((resolve) => {
				const existingAccount = existingAccounts[0];
				if (existingAccount) {
					getOrThrow(
						deviceEvolu.update(
							"account",
							{
								id: existingAccount.id as never,
								lastUseAt: PositiveInt.orThrow(Date.now()),
							},
							{
								onComplete: () => {
									resolve();
								},
							},
						),
					);
				} else {
					const { id } = getOrThrow(
						deviceEvolu.insert(
							"account",
							{
								name: NonEmptyString100.orThrow(faker.internet.username()),
								mnemonic,
								lastUseAt: PositiveInt.orThrow(Date.now()),
							},
							{
								onComplete: () => {
									resolve();
								},
							},
						),
					);
				}
			});

			setEvoluCounter((value) => value + 1);
		},
		onSuccess: props.onSuccess,
	});

	return (
		<AutoForm
			form={form}
			components={components}
			saveLabel={t("settings:form.switch-account-form.save-label.use-seed")}
		/>
	);
};
