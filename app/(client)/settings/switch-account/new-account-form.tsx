import {
	createOwnerSecret,
	createRandomBytes,
	getOrThrow,
	NonEmptyString100,
	ownerSecretToMnemonic,
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
import { defaultRelays } from "@/atoms/nostr-relays";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { WssUrl } from "@/lib/shared/types";

const formSchema = z.object({});
const createComponents = (t: TFunction) => createAutoFormLayout(formSchema, () => ({}));

export const NewAccountForm: React.FC<{
	onSuccess: () => unknown;
}> = (props) => {
	const { t } = useTranslation();
	const setEvoluCounter = useSetAtom(evoluCounterAtom);
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(formSchema, {
		defaultValues: {},
		saveAction: async () => {
			const mnemonic = ownerSecretToMnemonic(
				createOwnerSecret({
					randomBytes: createRandomBytes(),
				}),
			);

			await new Promise<void>((resolve) => {
				const { id } = getOrThrow(
					deviceEvolu.insert(
						"account",
						{
							name: NonEmptyString100.orThrow(faker.internet.username()),
							mnemonic,
							lastUseAt: PositiveInt.orThrow(Date.now()),
						},
						{
							onComplete: resolve,
						},
					),
				);
			});

			setEvoluCounter((value) => value + 1);
		},
		onSuccess: props.onSuccess,
	});

	return (
		<AutoForm
			form={form}
			components={components}
			saveLabel={t("settings:form.new-account-form.save-label.generate-a-new-account")}
		/>
	);
};
