import {
	createOwnerSecret,
	createRandomBytes,
	ownerSecretToMnemonic,
} from "@evolu/common";
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
import { NonEmptyString255, TimestampMs } from "@/lib/shared/types";

const formSchema = z.object({});
const createComponents = (_t: TFunction) =>
	createAutoFormLayout(formSchema, () => ({}));

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
				deviceEvolu.insert(
					"account",
					{
						name: NonEmptyString255(faker.internet.username()),
						mnemonic,
						lastUseAt: TimestampMs(Date.now()),
					},
					{
						onComplete: resolve,
					},
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
			saveLabel={t(
				"settings:form.new-account-form.save-label.generate-a-new-account",
			)}
		/>
	);
};
