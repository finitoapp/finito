import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useSetAtom } from "jotai";
import type React from "react";
import { z } from "zod";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { nostrSignerAtom } from "@/atoms/nostr-signer";
import { nostrSignersAtom } from "@/atoms/nostr-signers";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrl,
} from "@/lib/types";

export const switchAccountSchema = z.object({
	nsec: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

export const switchUserDefaultValues = {
	nsec: "",
} satisfies z.input<typeof switchAccountSchema>;

const components = createAutoFormLayout(switchAccountSchema, ({ builder }) => ({
	...builder.magicInput("nsec").textarea({
		placeholder: "paste your nsec",
		rows: 4,
	}),
}));

export const SwitchAccountForm: React.FC<{
	onSuccess?: () => unknown;
}> = (props) => {
	const setNostrSigner = useSetAtom(nostrSignerAtom);
	const setNostrSigners = useSetAtom(nostrSignersAtom);
	const setRelays = useSetAtom(nostrRelaysAtom);
	const form = useActionForm(switchAccountSchema, {
		defaultValues: switchUserDefaultValues,
		saveAction: async (values) => {
			const ndkSignerPayload = new NDKPrivateKeySigner(values.nsec).toPayload();

			setNostrSigner({
				ndkSignerPayload,
			});
			setNostrSigners((previous) => {
				for (const previousSigner of (previous ?? { signers: [] }).signers) {
					if (previousSigner.ndkSignerPayload === ndkSignerPayload) {
						return previous;
					}
				}

				return {
					signers: [
						...(previous !== null ? previous.signers : []),
						{
							ndkSignerPayload,
						},
					],
				};
			});
			setRelays({
				relays: [
					WssUrl("wss://relay.primal.net"),
					WssUrl("wss://relay.damus.io"),
				],
			});
		},
		onSuccess: props.onSuccess,
	});

	return (
		<AutoForm form={form} components={components} saveLabel={"Use seed"} />
	);
};
