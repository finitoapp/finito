import { type Mnemonic, sqliteTrue } from "@evolu/common";
import { faker } from "@faker-js/faker";
import type { TFunction } from "i18next";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { createDeviceQuery } from "@/lib/evolu/device";
import {
	NonEmptyString255,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const switchAccountSchema = z.object({
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

export const switchUserDefaultValues = {
	seed: "",
} satisfies z.input<typeof switchAccountSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(switchAccountSchema, ({ builder }) => ({
		...builder.magicInput("seed").textarea({
			placeholder: t(
				"settings:form.switch-account-form.placeholder.paste-your-seed",
			),
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
				createDeviceQuery((db) =>
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
					deviceEvolu.update(
						"account",
						{
							id: existingAccount.id,
							lastUseAt: Date.now(),
						},
						{
							onComplete: () => {
								resolve();
							},
						},
					);
				} else {
					deviceEvolu.insert(
						"account",
						{
							name: NonEmptyString255(faker.internet.username()),
							mnemonic,
							lastUseAt: Date.now(),
						},
						{
							onComplete: () => {
								resolve();
							},
						},
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
